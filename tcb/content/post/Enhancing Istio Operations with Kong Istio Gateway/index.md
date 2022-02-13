---
title: Enhancing Istio Operations with Kong Istio Gateway
date: 2022-02-12
tags:
  - kong
  - kubernetes
comment_id: 4fb27380-a2f5-4a09-9195-0d5a4f4b8125
---

If you're a developer for a service-oriented application, routing requests between services can be overwhelming. This work may force you to focus on operational details that take you away from building great features for your customers.

Fortunately, with [Kong Istio Gateway](https://konghq.com/solutions/istio-gateway/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community), we can solve many inter-service networking concerns such as security, resiliency, observability, and traffic control with services-first networking policies. By offloading network-related problems to the [service mesh](https://konghq.com/learning-center/service-mesh/what-is-a-service-mesh/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community), you can focus on building features that deliver business value.

In this article, we'll look more closely at Kong Istio Gateway, exploring its benefits and walking through key use cases for enhancing Istio with [Kong Gateway](https://konghq.com/kong/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community).

## Kong Istio Gateway Overview

By default, an Istio mesh in a Kubernetes cluster allows for communication between services within the cluster. To expose the services in the mesh to external traffic, [Kubernetes](https://konghq.com/learning-center/kubernetes/what-is-kubernetes/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community) supports an ingress controller named Kubernetes Ingress.

Istio comes with its own implementation of an ingress controller known as a _gateway_. Kong Istio Gateway is a drop-in replacement of the Istio ingress gateway. We can easily extend Kong with a wide range of [enterprise-grade plugins](https://docs.konghq.com/hub/) that address a variety of Layer 4 to Layer 7 application concerns such as [authentication](https://konghq.com/learning-center/api-gateway/api-gateway-authentication/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community), traffic routing, and [security](https://konghq.com/learning-center/api-gateway/building-a-secure-api-gateway/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community) at the gateway level.

Kong Istio Gateway is deployed as a regular service (of LoadBalancer type) in your service mesh, enabling you to use the entire suite of Istio APIs. The following diagram presents the logical path that an external request takes to reach the destination service in the presence of Kong Istio Gateway.

{{< img src="1.png" alt="Figure 1: Logical flow of request in Istio" >}}

The request originating outside the cluster first meets Kong Istio Gateway. The Ingress controller supplies the gateway's request-routing rules, which the gateway uses to route the request to the associated service. For communication within the mesh, the virtual service sends the request, which uses the destination's rules in the form of layer 7 attributes to determine which service subset should receive the request.

## Benefits of Using Kong Istio Gateway

You can easily extend the features of Kong Istio Gateway using plugins. The combination of plugins and ingress rules grants you absolute control over your application's requests and response pipeline. The following diagram illustrates the components involved in routing a client request to the destination service.

{{< img src="2.png" alt="Figure 2: Components involved in routing" >}}

There are a few key advantages of using Kong Istio Gateway over the Istio ingress gateway:

1. **Ability to add indirection in enforcing enterprise policies** : Kong's plugin hub provides a variety of plugins that the operations team can independently install without affecting the development process. We can use the plugins to quickly enforce organization-wide policies, such as [JWT authentication](https://konghq.com/blog/jwt-kong-gateway/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community).
2. **Support for application-level policies** : Istio gateway lets you configure routing rules at level 4 to level 6 of the network stack. For example, you can specify request routing rules based on attributes such as the port, host, TLS key, and certificates. Kong Gateway enables you to enforce application-level policies such as validating requests.
3. **Build custom request and response pipelines** : Using Kong [request-response transformation plugins](https://konghq.com/blog/api-gateway-request-transformation/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community), you can alter the request and response pipeline to support client requirements.

The ability to add plugins to Kong Gateway allows you to keep your application's architecture flexible so that you can iterate quickly in the face of changing requirements.

## Enhancing Istio Operations

The [Istio documentation website](https://istio.io/latest/docs/tasks/) outlines some key use cases of Istio:

1. **Traffic Management** : Includes capabilities such as request routing, fault injection, traffic shifting, circuit breaking, and mirroring.
2. **Security** : Includes certificate management, authorization, and authentication capabilities.
3. **Policy Enforcement** : Using Envoy to enforce rate limits.
4. **Observability** : Automatic collection of metrics, traces, and logs from services. It also includes support for out-of-box visualization tools such as Kiali.

Istio specializes in inter-service communication. Like other services in the service mesh, Kong Istio Gateway gets Envoy sidecar pods linked to its pods. This makes it strongly embedded in the service mesh. Kong has a rich set of capabilities to manage the north-south traffic (traffic between the client and the service). We will use these capabilities to enhance the inter-service communication (east-west traffic) capabilities of Istio.

## Demo Application: HTTP Echo

We will use a very basic application that echoes any HTTP request. This is the HTTP version of the popular [TCP echo sample application](https://github.com/istio/istio/tree/master/samples/tcp-echo) of Istio. I've used [Docker Desktop](https://www.docker.com/products/docker-desktop) with [Kubernetes enabled](https://www.docker.com/products/kubernetes) for this demo. You'll also need to have [helm](https://helm.sh/docs/intro/quickstart/) installed.

Here is the source code of the application:

```golang
package main

import (
    "net/http"
    "os"
    "time"
)

var prefix string

func main() {
    port := os.Args[1]
    prefix = os.Args[2]
    http.HandleFunc("/", echoHandler)
    http.ListenAndServe(":"+port, nil)
}

func echoHandler(writer http.ResponseWriter, request *http.Request) {
    request.Write(writer)
    writer.Write([]byte(prefix + " says OK at " + time.Now().String()))
}
```

Use the following Dockerfile to build the container image of the application:

```dockerfile
FROM golang:1.15.7-buster
ADD main.go /go/src/main.go
ENTRYPOINT [ "go", "run", "/go/src/main.go" ]
CMD [ "9000", "hello" ]
EXPOSE 9000
```

Next, use the following command to build the container image from the specification.

```shell
docker build -t http-echo .
```

You can either use the container image you built or the container image I published [on the DockerHub registry](https://hub.docker.com/r/rahulrai/http-echo). You can also inspect the [application source code in the GitHub repository](https://github.com/rahulrai-in/http-echo).

## Install Kong Istio Gateway

Follow the [Istio installation guide](https://istio.io/latest/docs/setup/install/istioctl/) instructions to download the Istio binaries and the Istio CLI tool: _istioctl_. We need just the Istio daemon, IstioD, for enabling Kong Istio Gateway. Use the following command to install just the IstioD component on your cluster:

```shell
istioctl install --set profile=minimal -y
```

Let's now deploy Kong Istio Gateway in our cluster. We will label the namespace of the gateway so that the gateway pod gets a sidecar and becomes a part of the service mesh. We will use the official Kong Helm chart to install Kong Istio Gateway in the cluster as follows:

```shell
kubectl create namespace kong-istio
kubectl label namespace kong-istio istio-injection=enabled
helm repo add kong https://charts.konghq.com && helm repo update
helm install -n kong-istio kong-istio kong/kong
```

We previously discussed how Kong Gateway gets deployed as a LoadBalancer service in the cluster. The service provides an external endpoint where you can send HTTP requests. Execute the following command to get the endpoint of the service.

```shell
kubectl get svc/kong-istio-kong-proxy -n kong-istio
```

## Install Service Mesh Visualization Tools

With Kong Gateway, we deployed the service mesh to manage our application. An advantage of having the gateway as part of the mesh is that we can use the excellent Istio mesh visualization tools to get a complete picture of the service topology. Let's now install Prometheus and Kiali. Later, we will use them to inspect the topology of our mesh using the following commands:

```shell
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.12/samples/addons/prometheus.yaml
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.12/samples/addons/kiali.yaml
```

## Install HTTP Echo Application

Now, let's deploy our service to the cluster and add it to the mesh. We will deploy two versions of the application that only differ in the response they produce on request. Create a YAML specification file named _echo-service.yaml_ for the HTTP Echo service. Remember to replace the name of the container image based on the container registry that you use (local or DockerHub):

```yaml
kind: Namespace
apiVersion: v1
metadata:
  name: echo
  labels:
    istio-injection: enabled
---
apiVersion: v1
kind: Service
metadata:
  name: http-echo
  namespace: echo
  labels:
    app: http-echo
    service: http-echo
spec:
  ports:
    - port: 8080
      name: http
  selector:
    app: http-echo
    version: v1
---
apiVersion: v1
kind: Service
metadata:
  name: http-echo-2
  namespace: echo
  labels:
    app: http-echo
    service: http-echo-2
spec:
  ports:
    - port: 8080
      name: http
  selector:
    app: http-echo
    version: v2
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: http-echo-v1
  namespace: echo
  labels:
    app: http-echo
    version: v1
spec:
  replicas: 1
  selector:
    matchLabels:
      app: http-echo
      version: v1
  template:
    metadata:
      labels:
        app: http-echo
        version: v1
    spec:
      containers:
        - name: http-echo
          image: http-echo:latest
          imagePullPolicy: IfNotPresent
          args: ["8080", "one"]
          ports:
            - containerPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: http-echo-v2
  namespace: echo
  labels:
    app: http-echo
    version: v2
spec:
  replicas: 1
  selector:
    matchLabels:
      app: http-echo
      version: v2
  template:
    metadata:
      labels:
        app: http-echo
        version: v2
    spec:
      containers:
        - name: http-echo
          image: http-echo:latest
          imagePullPolicy: IfNotPresent
          args: ["8080", "two"]
          ports:
            - containerPort: 8080
```

Apply the previous specification using the following command:

```shell
kubectl apply -f echo-service.yaml
```

We now have two services exposing the two versions of our application. However, we can't access these services from outside the cluster. We will use Kong Ingress Gateway to expose our services and realize a few common use cases next.

## Improve Traffic Management

Kong Istio Gateway can extend the [traffic management patterns](https://istio.io/latest/docs/tasks/traffic-management/) of Istio by adding capabilities such as GraphQL caching and routing to intermediary HTTP proxies. Implementing such complex policies is trivial with Kong. Let's first expose the services through the gateway, after which we will implement a common traffic management use case.

Create two ingress objects that route traffic to the two application versions on the default endpoint and the _/v2_ endpoint. Doing so will look like this:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-ingress
  namespace: echo
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /
            pathType: ImplementationSpecific
            backend:
              service:
                name: http-echo
                port:
                  number: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: kong-ingress-2
  namespace: echo
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /v2
            pathType: ImplementationSpecific
            backend:
              service:
                name: http-echo-2
                port:
                  number: 8080
---
```

Apply the specification to your cluster using the `kubectl apply` command. You can invoke the two endpoints from your browser and verify the output as follows:

{{< img src="3.png" alt="Figure 3: Two versions of Http Echo application" >}}

Let's now enforce rate limits on one of the versions of the application (v1). Let's also write the specification for the rate limit plugin. This allows a single request to reach the service as follows:

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: rate-limit
  namespace: echo
plugin: rate-limiting
config:
  minute: 1
  policy: local
```

Now, apply this policy by annotating the ingress object _kong-ingress_, which will enable Kong Gateway to apply the rate limit plugin on the routes covered by the ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    konghq.com/plugins: rate-limit
  name: kong-ingress
  namespace: echo
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /
            pathType: ImplementationSpecific
            backend:
              service:
                name: http-echo
                port:
                  number: 8080
```

Hit refresh on your browser instances to see how this policy affects the behavior of your application:

{{< img src="4.png" alt="Figure 4: Rate limit applied to a version of Http Echo application" >}}

Finally, let's visualize our service mesh topology with Kiali. Kiali will also help us understand how the various services interact. Execute the following command to launch the Kiali UI:

```shell
istioctl dashboard kiali
```

Navigate to the _Graph_ view of your application and enable the _Traffic Animation_ option to visualize the current network traffic flow.

{{< img src="5.png" alt="Figure 5: Kiali UI" >}}

You can explore a wide array of traffic control plugins available in [Kong's Plugin Hub](http://docs.konghq.com/hub/). Iterating here can improve the traffic management capabilities of Istio.

{{< img src="6.png" alt="Figure 6: Traffic control plugins in Kong Plugin Hub" >}}

## Improve the Security of Istio Managed Services

Istio provides key [security capabilities](https://istio.io/latest/docs/tasks/security/) such as authentication, authorization, and certificate management. Together, these components ensure that only trusted traffic flows between the services in the mesh. Kong Istio Gateway can improve the security of the mesh to include capabilities such as bot protection and IP restriction.

Let's configure the IP restriction plugin and apply it to version 2 (v2) of the HTTP Echo service as follows:

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongClusterPlugin
metadata:
  name: ip-restriction
  namespace: echo
  annotations:
    kubernetes.io/ingress.class: kong
config:
  allow:
    - 54.13.21.1
plugin: ip-restriction
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    konghq.com/plugins: ip-restriction
  name: kong-ingress-2
  namespace: echo
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /v2
            pathType: ImplementationSpecific
            backend:
              service:
                name: http-echo-2
                port:
                  number: 8080
```

After applying the policy, Kong Gateway will handle any request to the endpoint [http://localhost/v2](http://localhost/v2). It will respond with HTTP 403 as follows:

{{< img src="7.png" alt="Figure 7: IP restriction applied to a version of Http Echo application" >}}

## Improve Observability of Services

Istio has built-in support for distributed tracing, and since Kong Istio Gateway is yet another service in the service mesh, you will get end-to-end traces of requests traveling through the mesh. To view the traces generated by the application, let's install Jaeger with the following command:

```shell
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.12/samples/addons/jaeger.yaml
```

Remove annotations from the ingress resources so that traffic will reach the Echo application without constraints. Send a few requests to any version of the service. Using the following command, generate some telemetry and launch the Jaeger dashboard:

```shell
istioctl dashboard jaeger
```

On the Jaeger dashboard, you can see the dependency graphs of the services as follows:

{{< img src="8.png" alt="Figure 8: Dependency graph of the services" >}}

You can also track the traces generated by the services by filtering them in the search window. Distributed traces can help you identify performance issues in your application, and they are a great way to present the entire lifecycle of requests served by your [microservices](https://konghq.com/learning-center/microservices/?utm_source=guest&utm_medium=devspotlight&utm_campaign=community).

{{< img src="9.png" alt="Figure 9: Distributed traces in Jaeger" >}}

The suite of Logging plugins from Kong Gateway can improve the observability of services in the mesh even further. For example, you can use plugins to channel the logs to Kafka and StatsD.

{{< img src="10.png" alt="Figure 10: Logging plugins in Kong Plugin Hub" >}}

Let's add logging capabilities to our services by attaching the http logging plugin to our ingress service. First, create a [mockbin.org](https://mockbin.org/) endpoint with default settings and then apply this configuration to the ingress service with the mockbin id inserted on the `http_endpoint`:

```yaml
apiVersion: configuration.konghq.com/v1
kind: KongPlugin
metadata:
  name: http-log
  namespace: echo
config:
  http_endpoint: http://mockbin.org/bin/:id
  method: POST
  timeout: 1000
  keepalive: 1000
  flush_timeout: 2
  retry_count: 15
plugin: http-log
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    konghq.com/plugins: http-log
  name: kong-ingress
  namespace: echo
spec:
  ingressClassName: kong
  rules:
    - http:
        paths:
          - path: /
            pathType: ImplementationSpecific
            backend:
              service:
                name: http-echo
                port:
                  number: 8080
```

Send a few requests to the default endpoint and inspect the output in the bin that you created on [https://mockbin.org/](https://mockbin.org/):

{{< img src="11.png" alt="Figure 11: Logs transported to Mockbin by Kong logging plugin" >}}

## Conclusion

This article discussed installing Kong Istio Gateway in the Istio service mesh as a regular service. We also discussed how the north-south and east-west traffic flows in the cluster and how the presence of Kong Istio Gateway aids with that traffic flow. Finally, using a few examples, we discussed how you could enhance the key capabilities of Istio using Kong Gateway. If you want to gain the power of Istio in your systems, give it a try yourself!

{{< subscribe >}}

![Kong Istio Gateway visitors](https://badge.tcblabs.net/api/hc/rahul/kong-istio-gw "Kong Istio Gateway visitors")
