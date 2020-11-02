---
title: "Dynamic Admission Control in AKS with Azure Functions"
date: 2020-09-20
tags:
  - azure
  - kubernetes
  - compute
comment_id: 409b820c-fb58-11ea-adc1-0242ac120002
---

> This article is part of [#ServerlessSeptember](https://aka.ms/ServerlessSeptember2020). You'll find other helpful articles, detailed tutorials, and videos in this all-things-Serverless content collection. New articles from community members and cloud advocates are published every week from Monday to Thursday through September.
>
> Find out more about how Microsoft Azure enables your Serverless functions at [https://docs.microsoft.com/azure/azure-functions/](https://docs.microsoft.com/azure/azure-functions/?WT.mc_id=servsept20-devto-cxaall).

> **Nov 02,2020**: The implementation of validating webhook Azure Function that uses [Azure Communication Service](https://azure.microsoft.com/en-au/services/communication-services/) is available in the [feature/impl-azure-comm-service](https://github.com/rahulrai-in/az-fx-k8s-admission-control/tree/feature/impl-azure-comm-service) branch. The Twilio based implementation is available in the [master](https://github.com/rahulrai-in/az-fx-k8s-admission-control/tree/master) branch.

Controlling resource deployments in your [Azure Kubernetes Service (AKS)](https://azure.microsoft.com/en-au/services/kubernetes-service/) cluster can quickly become quite challenging. For instance, pushing a change to the production environment might introduce undesirable vulnerabilities to the application. By creating custom admission webhooks for Kubernetes, we can define custom policies that regulate the deployment of resources to our cluster. The Kubernetes ecosystem is not entirely devoid of solutions that you can use to govern the resources on your cluster. [OPA Gatekeeper](https://github.com/open-policy-agent/gatekeeper) is one such solution that is commonly used to enforce policies on a Kubernetes cluster. [Azure Policy](https://docs.microsoft.com/en-us/azure/governance/policy/concepts/policy-for-kubernetes) for Azure Kubernetes Service (AKS) extends the Gatekeeper to apply policies on your cluster in a centralized and consistent manner. The Gatekeeper and hence Azure Policy is built using the admission webhook feature of the Kubernetes.

You can install Azure Policy as an extension to AKS. It has several [in-built policies](https://docs.microsoft.com/en-us/azure/governance/policy/samples/built-in-policies#kubernetes) that you can enable on your cluster. One example of such policy is to enforce pods to only listen to an allowed list of ports. I have mentioned admission webhooks twice now. Let's discuss it in detail.

## Dynamic Admission Control

Kubernetes version 1.9 introduced two code packages that allow you to write custom admission plugins: `ValidatingAdmissionWebhook` and `MutatingAdmissionWebhook`. These plugins give you a great deal of flexibility to integrate directly into the resource admission process. An admission webhook/controller is a piece of code invoked by the Kubernetes API server before the persistence of the object. It comes into effect just before the request (e.g., to create a pod) is persisted in etcd (or other object storage), but after the request is authenticated and authorized. Several admission controllers are baked into Kubernetes, and they cover a range of functionality. One such admission controller is [`NamespaceExists`](https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/#namespaceexists) that throws an error if you attempt to create a resource in a namespace that does not already exist.

A `MutatingAdmissionWebhook` allows you to modify a resource to meet the criteria before being admitted into the cluster's data plane. For example, you can create a custom webhook that inspects whether the Ingress resource created enforces HTTPS only. If it doesn't, the webhook can modify the incoming specification of the Ingress resource so that it does.

A `ValidatingAdmissionWebhook` allows you to validate if a resource fits the expected criteria defined by your custom rules. For example, you can specify a requirement that every Pod being created should define its CPU and memory requirements. If it doesn't, you can deny the Pod creation request, and it will not be created. In this article, we will build a `ValidatingAdmissionWebhook` using Azure Functions and use it to control deployments on AKS. Validating admission webhooks can't mutate resources, and therefore they may be run in parallel to accept or reject a request.

Gatekeeper and hence Azure Policy is a Validating Admission Webhook that intercepts every request to create or update a Kubernetes object and accepts or rejects the request based on whether it meets the specified constraints. Building a ValidatingAdmissionWebhook or MutatingAdmissionWebhook is easier than you can imagine. In both cases, the Kubernetes API server makes a POST request to your webhook with an `AdmissionReview` object in the body. After processing the request, your webhook responds with an `AdmissionReview` object as well. The AdmissionReview type has a response field and a request field that are used by the API server and the webhook appropriately. When processing the incoming AdmissionReview request, you'll read the request field. When responding to the request with an AdmissionReview response, you'll populate the response field and include the unique identifier (UID) generated by the cluster. The cluster uses this UID to version a request.

The body of the incoming AdmissionReview contains the raw specification in the form of JSON for the object being created, updated, or deleted. This specification contains the same data that the Kubernetes API server will see when performing the requested API action. You can read more about the dynamic admission control [here in the Kubernetes documentation](https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/).

## Making Dynamic Admission Control Serverless

Using Azure Policy is the clean and recommended approach to enforcing constraints on your AKS cluster. However, there might be scenarios where you want to build custom admission webhooks to implement regulations to launch only the approved resources in your cluster. I recently presented at the [Serverless Days ANZ](https://anz.serverlessdays.io/) on how you can implement admission webhooks using Azure Functions. The serverless model of building admission webhooks gives you the ability to scale the deployment certification process and also enables you to take advantage of built-in bindings of Azure Functions to connect various services without writing a single line of code.

In the session, I covered one such scenario in which I wrote a validating admission webhook with Azure Functions and applied custom governance policies on the deployments in Kubernetes. I also used the native Azure Function Twilio binding to send SMS updates to SRE/Ops teams, informing them whether the requested deployment failed or succeeded. I recommend that you watch this session to understand the process of writing custom validating webhooks for Kubernetes. The policies that I implemented in the Azure Function webhook are as follows.

1. Prevent deployments if the count of the replicas is less than three and send a rich error SMS notification to the Ops team.
2. Inform the Ops team with a rich SMS message if the developer adds a new application to the cluster.
3. Inform the Ops team with a rich SMS message if a developer updates an existing application on the cluster.

{{< youtube ULtC9cSrY9s >}}

Although the approach to use an external serverless service works well with EKS (AWS) and GKE (Google Cloud), it doesn't work with AKS. The admission controllers are part of the Kubernetes API server and hence are managed by Azure. The firewall policies in Azure do not allow the API server to access any external HTTP endpoints. However, the API server can communicate with services within the cluster, which is a capability required by services such as Istio, NGINX, etc. to work.

If you have watched the previous video (it will help you understand this article further), you must have noticed that we can not use the token-based security feature of Azure Functions. By routing traffic to an external admission control serverless function through a service running within the cluster, you can not only implement whatever security measure that you like, but you can also implement custom policies within your in-cluster service itself.

## Solution Overview

The following diagram shows the architecture of our serverless webhook. The only addition over the architecture presented at the conference (hint: watch the video) is an in-cluster reverse proxy that forwards every request from the API server to the Azure Function.

{{< img src="1.png" alt="Serverless admission webhook on AKS" >}}

Let me walk you through the request and response path.

1. The developer requests the API server to create, update, or delete a deployment.
2. The API server runs the request through a series of admission controllers, including our custom validating webhook. The request reaches our reverse proxy service.
3. The reverse proxy service forwards the request to Azure Function that executes a series of checks on the request.
4. After finalizing its decision to accept or reject the request, Azure Function issues a call to Twilio to send an SMS message to the preconfigured Ops Team mobile number.
5. Twilio dispatches the requested SMS to the Ops team mobile number.
6. Azure Function returns the result to the reverse proxy.
7. The reverse proxy feeds the response to the API server.
8. The API server returns the response to the developer.

Let's build and deploy each of the components in the architecture one at a time.

## Azure Function

Let's start by creating a resource group first using the [AZ CLI](https://docs.microsoft.com/en-us/cli/azure/). Please substitute the values of the arguments of any of the AZ CLI instructions here onwards with your custom values if there are any conflicts.

```cmd
az group create --name dac-demo-rg --location australiaeast
```

We will leverage the same Azure Function that I used in my session (hint: the video). Please follow the instructions in the video to understand the application code and the steps to deploy the function. You can download the source code of the sample application from the following link.

{{< sourceCode src="https://github.com/rahulrai-in/az-fx-k8s-admission-control" >}}

Once your function is up and running, we'll create the reverse proxy service that the admission controller will invoke on each deployment request.

## AKS Cluster

Let's create an AKS cluster now. Use the following AZ CLI commands to create a low-cost AKS cluster in the resource group that you previously created.

```cmd
az aks create -n dac-demo --node-count 1 --node-vm-size Standard_B2s --load-balancer-sku basic --node-osdisk-size 32 --resource-group dac-demo-rg --generate-ssh-keys
az aks get-credentials --resource-group dac-demo-rg --name dac-demo
```

After executing the previous commands, you may use the kubectl CLI to operate your AKS cluster. Let's now build and deploy our reverse proxy to this cluster.

## Reverse Proxy

Download the source code of the reverse proxy application from the following link.

{{< sourceCode src="https://github.com/rahulrai-in/az-fx-dac-rp" >}}

I implemented the reverse proxy service in Go. If you are not comfortable/familiar with Golang yet, you can write the same implementation in the language of your choice. I have also published the image of the reverse proxy application here: [az-fx-k8s-dac:latest](https://hub.docker.com/repository/docker/rahulrai/az-fx-k8s-dac/)

Let's jump to the implementation of the reverse proxy. Navigate to the `main.go` file and inspect the `main` function with me.

```go
func main() {
 if err := envconfig.Process("DAC_PROXY_", config); err != nil {
  log.Panic("Failed to load configuration", err)
 }

 log.Infoln(config)
 server := GetAdmissionValidationServer(config.ListenOn)
 if err := server.ListenAndServeTLS(config.TlsCert, config.TlsKey); err != nil {
  log.Panic("Listener failed", err)
 }
}
```

The first instruction in the function reads the configuration from environment variables (prefixed with string `DAC_PROXY_`) or the default value if the environment variables are not available. The struct `Config` contains the configuration keys and the default values. In your implementation, you must override the URL of the Azure Function if you intend to use the container image that I published or want to use the program without making any changes to it. To do so, add an environment variable named `DAC_PROXY_DacFxUrl` to your pod. You can find the details on [injecting environment variables to pods here](https://kubernetes.io/docs/tasks/inject-data-application/define-interdependent-environment-variables/).

```go
type Config struct {
 ListenOn string `default:"0.0.0.0:8080"`
 TlsCert  string `default:"/etc/az-fx-proxy/certs/cert.pem"`
 TlsKey   string `default:"/etc/az-fx-proxy/certs/key.pem"`
 DacFxUrl string `default:"https://dac-demo-fx.azurewebsites.net/api/AdmissionControlFx"`
}
```

The next set of instructions configure the server. One of the key requirements of the dynamic admission control webhook is that its address scheme must be "https" (URL must begin with "https://"). I added a TLS certificate and its key as arguments to the `server.ListenAndServeTLS` function to fulfill this requirement. Later, we will use a script to create and store these certificates in a Kubernetes secret and mount the secret as a volume to this application.

Let's inspect the code responsible for forwarding the incoming request to the Azure Function that we deployed previously.

```go
func GetAdmissionValidationServer(listenOn string) *http.Server {
 var mux *http.ServeMux = http.NewServeMux()
 mux.HandleFunc("/", reverseProxyHandler)
 server := &http.Server{
  Handler: mux,
  Addr:    listenOn,
 }

 return server
}

func reverseProxyHandler(res http.ResponseWriter, req *http.Request) {
 log.Infoln("Sending request to function")
 processRequest(config.DacFxUrl, res, req)
}

func processRequest(target string, res http.ResponseWriter, req *http.Request) {
 dacFxUrl, _ := url.Parse(target)

 proxy := httputil.NewSingleHostReverseProxy(dacFxUrl)

 req.URL.Host = dacFxUrl.Host
 req.URL.Scheme = dacFxUrl.Scheme
 req.Host = dacFxUrl.Host

 proxy.ServeHTTP(res, req)
}
```

We need to expose just one endpoint capable of receiving a POST request from the admission controller. The `GetAdmissionValidationServer` function defines the handler for this endpoint. The request handler forwards the request to the Azure Function. Note that our function accepts anonymous traffic from the internet as follows.

```cs {linenos=table,hl_lines=[3]}
[FunctionName("AdmissionControlFx")]
public static async Task<IActionResult> Run(
    [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)]
    HttpRequest req,
    [TwilioSms(AccountSidSetting = "TwilioAccountSid", AuthTokenSetting = "TwilioAuthToken", From = "+19166193571")]
    ICollector<CreateMessageOptions> twilioSms)
```

However, you can easily alter the `AuthorizationLevel` of your function so that your function only accepts requests if it includes the appropriate API key. You can read more about authorizing operations on your HTTP Triggered Azure Functions in the [Microsoft documentation](https://docs.microsoft.com/en-us/azure/azure-functions/functions-bindings-http-webhook-trigger).

If you change the Azure Function's authorization level, make a change to the `processRequest` function to add a header named `x-functions-key` with the function's API key as the value. After the change, the header will be injected in every request to the Azure Function.

You can use the Dockerfile present in the repository to build and publish the container image of the application. Otherwise, you can use the container image that I published to DockerHub.

## Deploying and Testing the Webhook

There are two steps to deploying the reverse proxy and enabling the webhook. In the first step, we will publish the certificates required by our webhook. Next, we will deploy our custom webhook specification to AKS.

### Publishing the Certificates

Navigate to file `generate-certificates.sh` in the folder named specifications. The script generates new TLS/SSL certificates and signs them. Note that the Common Name (CN) specified in the certificate should be the local hostname of your service.

> Credit to my friend [Tarun Pabbi](https://www.tarunpabbi.com/), who helped me write this script.

```sh {linenos=table,hl_lines=[8]}
# Create CA certificate and key
openssl req -nodes -new -x509 -keyout ca.key -out ca.crt -subj "/CN=Admission Controller Demo CA"

# Generate the private key for the reverse proxy
openssl genrsa -out key.pem 2048

# Generate a Certificate Signing Request (CSR) for the private key, and sign it with the private key of the CA.
openssl req -new -key key.pem -subj "/CN=az-fx-dac-rp.default.svc" \
    | openssl x509 -req -CA ca.crt -CAkey ca.key -CAcreateserial -out cert.pem

# The API server requires the B64 encoded CA certificate to ensure that request is originating from the correct source.
openssl base64 -in ca.crt -out b64ca.crt

# The generated certificate has newline characters which need to be removed.
cat b64ca.crt | tr -d '\n' > b64ca-formatted.crt
```

The set of commands in the previous code listing will generate the certificates used by our reverse proxy. We will now publish the generated certificates as secrets in our AKS cluster with the following command.

```sh
# Store the certificates in a secret
kubectl create secret generic dac-rp-cert --from-file=cert.pem --from-file=key.pem
```

Next, we will mount the `dac-rp-cert` secret to our reverse proxy service as a volume. Executing the script `generate-certificate.sh` also creates the Base64 encoded copy of the CA certificate. We will use this certificate in the next specification that we will use to deploy the admission webhook.

### Deploying the Serverless Admission Webhook

We are the very last stretch of this exercise. I hope that you are excited to see the result. Navigate to the file `dac-rp-spec.yaml` in the specifications folder. The first two specifications deploy the reverse proxy to our cluster. Note that the name of the service must be the same as what you specified in the Common Name (CN) field of the certificate.

I would like you to note how we mounted the `dac-rp-cert` secret as a volume to the pod. The path of this volume is the same as the location that our reverse proxy is going to look up for the TLS certificate and the key.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: az-fx-dac-rp
  labels:
    app: az-fx-dac-rp
spec:
  ports:
    - name: https
      port: 443
      targetPort: 8080
  selector:
    app: az-fx-dac-rp
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: az-fx-dac-rp
  labels:
    app: az-fx-dac-rp
spec:
  selector:
    matchLabels:
      app: az-fx-dac-rp
  replicas: 1
  template:
    metadata:
      name: az-fx-dac-rp
      labels:
        app: az-fx-dac-rp
    spec:
      containers:
        - name: az-fx-dac-rp
          image: rahulrai/az-fx-k8s-dac:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
          resources:
            limits:
              memory: 50Mi
              cpu: 300m
            requests:
              memory: 50Mi
              cpu: 300m
          volumeMounts:
            - name: dac-certs
              mountPath: /etc/az-fx-proxy/certs
              readOnly: true
          securityContext:
            readOnlyRootFilesystem: true
      volumes:
        - name: dac-certs
          secret:
            secretName: dac-rp-cert
```

Now comes the most critical part of the specification. The following specification deploys our Validating Webhook to Kubernetes. If any part of this specification is new to you, I recommend that you watch the relevant portion of [my session on YouTube](https://www.youtube.com/watch?v=ULtC9cSrY9s) again. In a nutshell, this policy will only affect requests to create or update a deployment within a namespace.

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: compliance
webhooks:
  - name: compliance.custom.azure.com
    clientConfig:
      service:
        name: az-fx-dac-rp
        namespace: default
        path: "/"
        port: 443
      caBundle: "<value copied from b64-formatted.crt>"
    rules:
      - apiGroups: ["apps"]
        apiVersions: ["*"]
        operations: ["CREATE", "UPDATE"]
        resources: ["deployments"]
        scope: "Namespaced"
    timeoutSeconds: 30
    failurePolicy: Fail
    sideEffects: None
    admissionReviewVersions: ["v1", "v1beta1"]
```

Use the following command to deploy this specification file to your cluster.

```cmd
kubectl apply -f dac-rp-spec.yaml
```

After successful deployment, we are now ready to test our webhook. Are you ready?

## Testing the Webhook

We will use the test specification file - [alpine-spec.yaml](https://github.com/rahulrai-in/az-fx-k8s-admission-control/tree/master/specifications) to test our webhook. Download this specification so that you can make changes to it and apply it a few times. Initially, we will try to trigger the Azure Function's validation rule that fails the deployment if the count of replicas is less than 3.

```yaml
kind: Namespace
apiVersion: v1
metadata:
  name: app-ns
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alpine-deploy
  namespace: app-ns
  labels:
    app: alpine
spec:
  selector:
    matchLabels:
      app: alpine
  replicas: 2
  template:
    metadata:
      labels:
        app: alpine
    spec:
      containers:
        - name: my-alpine-container
          image: alpine:3.9.1
          ports:
            - containerPort: 80
```

To test the specification, execute the following command.

```cmd
kubectl apply -f alpine-spec.yaml
```

I will present screenshots of the test cases and the SMS that I received for each scenario. I use the [Your Phone Windows 10 app](https://support.microsoft.com/en-us/your-phone-app) on my PC to do many things, including receiving SMS. You should try it too!

### Case 1: Replica Count < 3

{{< img src="2.png" alt="Admission controller declined the deployment" >}}

### Case 2: Successful Deployment

Change the value of the property `replicas` in the previous specification to a number greater than or equal to 3. Apply the specification again after making the change.

{{< img src="3.png" alt="Admission controller accepted new deployment" >}}

### Case 3: Successful Update

Change the name of the image to `alpine:3` so that reapplying the specification triggers an update.

{{< img src="4.png" alt="Admission controller accepted the update of deployment" >}}

With this test, we have covered all the scenarios that we implemented in the Azure Function.

## Conclusion

We gained a high degree of control over our cluster by creating a serverless admission webhook with an Azure Function and a reverse proxy. We can now deny non-compliant deployments in a scalable, highly available, and secure fashion with a serverless architecture. You can extend this solution to address even more problems by manipulating Kubernetes objects with the ValidatingAdmissionWebhook and MutatingAdmissionWebhook APIs. I like the serverless solution because it helps you streamline policies if you have multiple Kubernetes clusters on which you want to enforce the policies consistently (including dev machines and DevOps pipelines). I hope that this article provided you a foundation to continue building features for your AKS projects.

{{< subscribe >}}
