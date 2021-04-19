---
title: "Using CoreDNS to Conceal Network Identities of Services in Istio"
date: 2019-10-31
tags:
  - kubernetes
  - service-mesh
comment_id: 58822e20-0534-4131-b0a6-e762cc7960e0
---

A crucial feature of the Istio Service Mesh is that it grants you absolute control over how you want to route traffic to a service. Each service on the Istio service mesh has a unique network identity that it receives from the underlying host, i.e., Kubernetes. For example, a service named _foo_ provisioned in a namespace named _bar_ will have the FQDN (Fully Qualified Domain Name) _foo.bar.svc.cluster.local_, which also serves as its network identity. Other services within the cluster can use the network identity of _foo_ to send requests to it, which will reach one of the pods executing an instance of the service.

For a service accessible to clients outside the cluster, the clients can use an address that resolves to the IP address of the Istio ingress gateway. After evaluating the request, the gateway will route the request to the destination service, thus abstracting the external client form the network identity of the destination service. For example, as depicted in the following diagram, the client of a hypothetical service, which is addressable at _saturn.planet.net_, is oblivious of the network identity of the service within the cluster.

{{< img src="1.png" alt="Ingress Gateway acting as NLB" >}}

The previous diagram depicts the actual path of a request originating outside the cluster to the Saturn service. The FQDN, _saturn.planet.net_, used by the client, resolves to the IP address of the Istio ingress gateway. The gateway interacts with the Istio service registry to direct the incoming request to an instance of the Saturn service. Note that communication between the actual service and the gateway also involves a sidecar proxy, but it is excluded from the diagram for brevity.

## The Challenge

Assigning a hostname to an internet-facing microservice brings indirection between the network identity of the service within the cluster and the address on which it is accessible to the external clients. With the indirection, a service can easily change its location (inside and outside the cluster) and its name without affecting its external clients.

The level of flexibility that services offer to external clients is unavailable to the internal clients since service to service communication within the cluster takes place using the network identity of the service. The lack of indirection means that developers can&#39;t rename the services or namespaces without also affecting the clients. Moreover, porting services to infrastructure outside the cluster or moving them to another cluster also affects their name, which in turn requires changes to the clients of the services. Because of such issues, a system with many interconnected microservices needs to establish abstraction between the addresses and identities of services operating within the cluster.

## Solution

A potential solution for systems that have all their services exposed to the internet via ingress gateway is to use the external endpoints of the services for communication. Using an external endpoint for service to service communication is a bad practice as such communication should still take place within the cluster for performance and security reasons. In networking, this form of communication is known as [hairpinning](https://en.wikipedia.org/wiki/Hairpinning), which in the context of Kubernetes, translates to service to service communication in which requests from a service leave the cluster and then re-enter the cluster to reach the destination service.

Today, we will discuss a potential solution to this problem by configuring the DNS used by Istio and the DNS used by Kubernetes, which is CoreDNS for both the systems. In Istio, you can add custom DNS records to the service registry using the _ServiceEntry_ configuration resource. Envoy uses the service registry of Istio and Kubernetes to detect the location of any service in the cluster. Istio uses a [CoreDNS plugin](https://github.com/istio-ecosystem/istio-coredns-plugin) to read the service entries and associate the IP addresses of services to their host addresses. The DNS plugin is deployed to the cluster when you install Istio with the following [installation option](https://istio.io/latest/docs/setup/install/multicluster/gateways/).

```plaintext
--set istiocoredns.enabled=true
```

For a cluster that has both the Kubernetes CoreDNS and Istio CoreDNS services running, we can use the approach illustrated in the following diagram to assign a host address to service and use the host address to communicate with it within the cluster.

{{< img src="2.jpg" alt="Resolving IP address of service" >}}

Let's briefly discuss what is happening here. Istio CoreDNS, which is deployed as _istiocoredns_ service in the cluster, registers all the service entries as DNS records. A limitation of the Istio CoreDNS plugin is that it ignores service entries that don't have an associated IP address (see [source](https://github.com/istio-ecosystem/istio-coredns-plugin/blob/913318ff584d1e522ba1d8195fa4a2e9df51fa91/plugin.go#L70)). Therefore, our service _bar_ must have a fixed cluster IP address. Since _istiocoredns_ is responsible for service entry DNS records, we configure _kube-dns_ (Kubernetes CoreDNS) to forward all resolve requests for domain names managed by Istio DNS to _istiocoredns_. Assuming that we want to assign the FQDN _thebar.internal_ to the service _bar_, the following is how the service _foo_ will communicate with the service _bar_ within the cluster.

1. A service entry record that maps the FQDN _thebar.internal_ to the cluster IP of the _bar_ service is applied to the mesh so that the DNS record is available to the _istiocoredns_ service. Kubernetes DNS service _kube-dns_ is configured to forward any resolve requests for domain name _internal_ to _istiocoredns_.
2. Service _foo_ sends a request to the _bar_ service at the address [http://thebar.internal](http://thebar.internal).
3. Envoy sends a resolve request to the _kube-dns_ service to resolve the IP address of the request.
4. The _kube-dns_ service forwards the request to _istiocoredns_.
5. The _istiocoredns_ service returns the IP address of the service to _kube-dns_.
6. Envoy uses the resolved IP address to communicate with the service _bar_.
7. Envoy sends the request to the _bar_ service.

Let's build a simple demo to illustrate this workflow.

## Demo

Before I start with the demo, I would like to point you to the code repository for this sample which is located here.

{{< sourceCode src="https://github.com/rahulrai-in/coredns-svc-id" >}}

The prerequisite of this demo is a Kubernetes cluster with Istio deployed to it. I assume that you are using CoreDNS in both Kubernetes and Istio, which is the default DNS resource in the recent versions of Kubernetes. I am using Docker Desktop for Windows with Kubernetes enabled for local development, but feel free to use whatever makes you happy.

I built a simple Nodejs REST API that returns a list of fruits available in a country based on the country code passed to it as an argument. To test the service on the dev box, execute the following command to create a container and bind it to port 3000 on the localhost.

```shell
$ docker run -p 3000:3000 --name fruits-api istiosuccinctly/fruits-api:1.0.0
```

Use another terminal instance to send a request to the API to fetch fruits and their prices for the country Australia whose country code is _au_. Other country codes supported are _ind_ and _usa_.

```shell
$ curl http://localhost:3000/api/fruits/au

{"nectarine":2.5,"mandarin":2.3,"lemon":1.1,"kiwi":2.6}
```

Let's deploy this service to our cluster now. The first resource we will need is a namespace with the label _istio-injection_ set to _enabled_ so that Istio can inject a sidecar to all the service pods within this namespace. The following listing presents the definition of the namespace named _micro-shake-factory_.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: micro-shake-factory
  labels:
    istio-injection: enabled
```

Next, we will create a deployment and a service for the _fruits-api_ service using the following specification.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: fruits-api-deployment-v1
  namespace: micro-shake-factory
spec:
  selector:
    matchLabels:
      app: fruits-api
  replicas: 1
  minReadySeconds: 1
  progressDeadlineSeconds: 600
  template:
    metadata:
      labels:
        app: fruits-api
        version: "1"
    spec:
      containers:
        - name: fruits-api
          image: istiosuccinctly/fruits-api:1.0.0
          imagePullPolicy: IfNotPresent
          resources:
            limits:
              cpu: 1000m
              memory: 1024Mi
            requests:
              cpu: 100m
              memory: 100Mi
          ports:
            - name: http-fruits-api
              containerPort: 3000
          env:
            - name: app_version
              value: "1"
---
apiVersion: v1
kind: Service
metadata:
  name: fruits-api-service
  namespace: micro-shake-factory
spec:
  selector:
    app: fruits-api
  ports:
    - name: http-fruits-api-service
      port: 80
      targetPort: http-fruits-api
  clusterIP: 10.103.1.1
```

In the previous specification, note that we reserved a cluster IP address by setting the property _clusterIP_ with an IP address that lies within the CIDR range of the cluster. You can check the CIDR range for your cluster in the _service-cluster-ip-range_ property of the _kube-apiserver_ specification.

Finally, we will configure a Virtual Service using the following specification that will route all traffic to the _fruits-api-service_.

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: fruits-api-vservice
  namespace: micro-shake-factory
spec:
  hosts:
    - fruits-api-service
  http:
    - route:
        - destination:
            host: fruits-api-service
            port:
              number: 80
```

Let's combine all the previous specifications in a single file and apply them to the cluster using the following command.

```shell
$ kubectl apply -f https://raw.githubusercontent.com/rahulrai-in/coredns-svc-id/master/fruits-api-svc.yaml

namespace/micro-shake-factory created
deployment.apps/fruits-api-deployment-v1 created
service/fruits-api-service created
virtualservice.networking.istio.io/fruits-api-vservice created
```

We will now install a temporary pod in our cluster and lookup the address of the _fruits-api-service_ by executing the following command.

```shell
$ kubectl run dnsutils -it --rm --generator=run-pod/v1 --image=tutum/dnsutils bash

If you don't see a command prompt, try pressing enter.
root@dnsutils:/#
```

The previous command will open a shell through which we will use _dig_ (Domain Information Groper) to find out the resolved IP address of the FQDN _fruits-api-service.micro-shake-factory.svc.cluster.local_.

```shell
root@dnsutils:/# dig fruits-api-service.micro-shake-factory.svc.cluster.local

; <<>> DiG 9.9.5-3ubuntu0.2-Ubuntu <<>> fruits-api-service.micro-shake-factory.svc.cluster.local
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 60665
;; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1
;; WARNING: recursion requested but not available

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;fruits-api-service.micro-shake-factory.svc.cluster.local. IN A

;; ANSWER SECTION:
fruits-api-service.micro-shake-factory.svc.cluster.local. 5 IN A 10.103.1.1

;; Query time: 0 msec
;; SERVER: 10.96.0.10#53(10.96.0.10)
;; WHEN: Thu Oct 31 04:32:07 UTC 2019
;; MSG SIZE  rcvd: 157
```

In the output, notice the IP address received in the _ANSWER SECTION,_ which is the same as the cluster IP that we reserved for the _fruits-api-service_. Also, note the IP address of the DNS server that was used for the lookup, 10.96.0.10, which is the cluster IP of the _kube-dns_ DNS server.

### Configuring CoreDNS

CoreDNS is configured using a special file called Corefile which is a declaration of [plugins](https://coredns.io/manual/plugins/) that execute in sequence to resolve an FQDN. We will configure the corefile used by _kube-dns_ to route all resolve requests for hostname _internal_ to _istiocoredns_. First, execute the following command to find the IP address of the _istiocoredns_ service.

```shell
$ kubectl get svc/istiocoredns -n istio-system -o jsonpath='{.spec.clusterIP}'

'10.98.61.255'
```

We will now edit the corefile of _kube-dns_ in the _kube-system_ namespace. This file is stored as a configmap named _coredns_ in the namespace _kube-system_. Execute the following command to launch an editor to edit the configmap.

```shell
$ kubectl edit configmap/coredns -n kube-system
```

Edit the corefile to add (not replace) the following section to the configuration. After saving the changes, any requests to resolve an address with domain name _internal_ will be routed to _istiocoredns_.

```plaintext
internal:53 {
    errors
    cache 30
    forward . 10.98.61.255 # istio core dns service ip
}
```

Let's create a service entry that will associate the name _my-fruits.internal_ to the cluster IP of our service.

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: exotic-fruits-service-entry
  namespace: micro-shake-factory
spec:
  hosts:
    - my-fruits.internal
  location: MESH_INTERNAL
  addresses:
    - 10.103.1.1
  endpoints:
    - address: fruits-api-service.micro-shake-factory.svc.cluster.local
  resolution: DNS
```

Apply the previous configuration to the cluster by executing the following command.

```shell
$ kubectl apply -f [https://raw.githubusercontent.com/rahulrai-in/coredns-svc-id/master/fruits-api-se.yml](https://raw.githubusercontent.com/rahulrai-in/coredns-svc-id/master/fruits-api-se.yml)

serviceentry.networking.istio.io/exotic-fruits-service-entry created
```

Finally, we need to ensure that _istiocoredns_ realizes that the hostname _internal_ can be resolved by the plugin _istio-coredns-plugin_ so that it does not fail the resolution request by returning a NXDOMAIN response. The plugin will use the service entry record that we created previously to resolve the IP address of the service. Just like _kube-dns_, _istiocoredns_ stores the corefile as a configmap. Execute the following command to edit the file.

```shell
$ kubectl edit configmap/coredns -n istio-system
```

There are two approaches to editing the corefile of _istiocoredns_ which vary with the version of CoreDNS. If the version of CoreDNS is < 1.4.0 (it will be evident from the file structure, [see source](https://github.com/istio/istio/blob/master/install/kubernetes/helm/istio/charts/istiocoredns/templates/configmap.yaml)), then update the configuration to resemble the following.

```plaintext
Corefile: |
.:53 {
        errors
        health
        proxy internal 127.0.0.1:8053 {
        protocol grpc insecure
        }
        proxy global 127.0.0.1:8053 {
        protocol grpc insecure
        }
        prometheus :9153
        proxy . /etc/resolv.conf
        cache 30
        reload
    }
```

If the version of CoreDNS is > 1.4.0, change the configuration to resemble the following.

```plaintext
Corefile: |
.:53 {
        errors
        health
        grpc internal 127.0.0.1:8053
        grpc global 127.0.0.1:8053
        forward . /etc/resolv.conf {
        except global internal
        }
        prometheus :9153
        cache 30
        reload
    }
```

Changes to DNS service takes a few minutes to propagate in the cluster. After a few minutes, execute another _dig_ command to resolve the FQDN _my-fruits.internal_.

```shell
root@dnsutils:/# dig my-fruits.internal

; <<>> DiG 9.9.5-3ubuntu0.2-Ubuntu <<>> my-fruits.internal
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 41374
;; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1
;; WARNING: recursion requested but not available

;; OPT PSEUDOSECTION:
; EDNS: version: 0, flags:; udp: 4096
;; QUESTION SECTION:
;my-fruits.internal.            IN      A

;; ANSWER SECTION:
my-fruits.internal.     30      IN      A       10.103.1.1

;; Query time: 1 msec
;; SERVER: 10.96.0.10#53(10.96.0.10)
;; WHEN: Thu Oct 31 05:53:11 UTC 2019
;; MSG SIZE  rcvd: 81
```

Note that we again received the cluster IP address of _fruits-api-service_ on resolving the FQDN. The same resolution means that any service inside the cluster can use the FQDN _my-fruits.internal_ to communicate with the service _fruits-api-service_. With the indirection in place, developers can easily update the name and location of the _fruits-api-service_ without affecting its clients. After the initial setup, you can onboard other services to the mesh as well and use FQDNs with domain name _internal_ to communicate with them by simply adding new service entry configurations.

This article is an extension of a discussion from my upcoming **FREE** title on Istio. I crammed much knowledge of Istio in a few pages so that you don't spend weeks learning it. You should subscribe to this blog to not miss out on the launch.

{{< subscribe >}}
