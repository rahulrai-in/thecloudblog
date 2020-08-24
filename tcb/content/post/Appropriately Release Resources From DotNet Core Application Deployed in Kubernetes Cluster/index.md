---
title: "Appropriately Release Resources From DotNet Core Application Deployed in Kubernetes Cluster"
date: 2018-09-08
tags:
  - kubernetes
comment_id: 4cfc807e-324d-4d9e-a424-997bdd9c9444
---

You have deployed your DNC (Dot Net Core) application on your Kubernetes cluster and to make it efficient, you have initialized resources, kept a database channel open, and did a ton of other things during the initialization of your application. Did you miss something?

One of the critical tasks that you must do is cleaning up the resources, shutting down the open channels, and gracefully shutting off what you turned on and so on from your application when Kubernetes instructs your container to shut down.

Pods or the home of containers are ephemeral, and Kubernetes may instruct the containers to shut down for multiple reasons, such as scaling down the cluster or scheduling pods on a different node to accommodate others. More commonly, your application will get this signal when you apply a rolling update to your application.

## Solution

Containers in Kubernetes get several lifecycle hooks to which you can attach application code. Kubernetes raises different signals that are Linux interrupts sent to a process. A process can choose how it responds to those signals when they are received.

You can't ignore **SIGKILL** and **SIGSTOP** even if you want to because the Operating System enforces them, but your application can attach a callback to the **SIGTERM** signal which Kubernetes uses to shut down a container.

## Ideal Implementation

If your service takes a long time to respond to requests from external services, or you don't want your container to keep processing a request when your container is instructed to destroy itself, then you must start responding to readiness probes with an error response when the container receives the **SIGERM** signal. Doing so will instruct the Kubernetes controller not to route any further requests to your container. You can afterward wait for a few seconds for existing requests to complete and then start cleaning up the resources. The default time that you get to perform all these operations including cleanup of resources is 30 seconds after which a **SIGKILL** interrupt will kill your container.

## Implementation in DotNet Core

Following is the code listing for a simple application that attaches a callback to the SIGTERM signal and sets the value of a variable that will be read by the API controller to respond to readiness probe.

```cs
public static void Main(string[] args)
{
    // Listen for the SIGTERM interrupt. You can also use the AppDomain.CurrentDomain.ProcessExit event.
    AssemblyLoadContext.Default.Unloading += Cleanup;
}

private static void Cleanup(AssemblyLoadContext obj)
{
    // Set a variable used by readiness probe to false. Now, I have 30 seconds to live.
    Thread.Sleep(10000);
    // Release all the resources. I am going to die soon.
}
```

Next, let's define an API controller that responds to the readiness probe.

```cs
[Route("api/[controller]")]
public class HealthController : Controller
{

    [HttpGet("Readiness")]
    public async Task<ActionResult> Readiness()
    {
        // Set this variable to true or false depending on whether you want to receive more requests.
        var healthCheck = true;

        if (healthCheck)
        {
            return Ok();
        }

        return StatusCode((int) HttpStatusCode.ServiceUnavailable);
    }
}
```

Let's now instruct Kubernetes to use our custom endpoint for the readiness probe.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: propershutdownapi
spec:
  selector:
    app: propershutdownapi
  ports:
    - port: 32001
      nodePort: 32001
      targetPort: 80
  type: NodePort
---
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: propershutdownapi
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: propershutdownapi
    spec:
      restartPolicy: Always
      containers:
        - image: propershutdownapi:v1
          imagePullPolicy: IfNotPresent
          name: propershutdownapi
          readinessProbe:
            httpGet:
              path: /api/Health/Readiness
              port: 80 # Port on which probe should make request.
            initialDelaySeconds: 10 # Start probing after 10 seconds of container creation.
            timeoutSeconds: 1 # Timeout if you don't get a response in 1 second.
            periodSeconds: 10 # Probe frequency in seconds.
            failureThreshold: 2 # Probe declares failure after 2 attempts.
          ports:
            - containerPort: 80
              name: http
              protocol: TCP
```

That's it. You can apply this configuration on your cluster by using the `kubectl apply` command. You can test this solution by creating a cluster and killing a pod by reducing the replica count in the previous configuration and using telemetry to record the operation.

{{< subscribe >}}
