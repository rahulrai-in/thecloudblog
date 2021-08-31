---
title: Limit Communication Between Microservices with Kubernetes Network Policies
date: 2021-08-31
tags:
  - azure
  - kubernetes
comment_id: 7f81a6f9-c4c5-40c2-9661-2b9dced524db
---

{{< tweet 1432590473198141442 >}}

Security is an important concern for microservices applications. Although security is a broad topic, I want to zoom into a critical aspect: limiting communication between microservices. By default, microservices platforms such as Kubernetes allow unconstrained communication between services. However, to prevent a few compromised services from affecting all the services on the platform, a microservices platform needs to limit the interactions between services. This constraint is enforced by creating [network policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/) in Kubernetes. Network policies allow you to specify which services can communicate with each other and which services can't. For example, you can specify that a service can only communicate with other services in the same namespace with a network policy.

A Kubernetes cluster needs a network controller to enforce the network policies. The network controller is a special pod that runs on every node in the cluster (a.k.a DaemonSet). It monitors the network traffic between services and enforces the network policies.

AKS supports two types of network controllers (called network plugins): [Azure CNI](https://docs.microsoft.com/en-us/azure/aks/configure-azure-cni) and [Kubenet](https://docs.microsoft.com/en-us/azure/aks/configure-kubenet). You can't install a network controller on an existing Azure Kubernetes Service (AKS) cluster. Also, network policies have no effect in a Kubernetes cluster that does not have a network controller. The policies will not produce any errors, but they will not limit the traffic between services either.

You can read more about supported network plugins on AKS: Azure (for Calico and Azure network policies) and Kubenet (for Calico policies) in the [Azure Kubernetes Service documentation](https://docs.microsoft.com/en-us/azure/aks/use-network-policies). We will use the `azure` network plugin to create an Azure CNI network controller for our network policy.

Note that Docker Desktop does not support network controllers, so you need to create an AKS cluster for this tutorial.

Execute the following AZ CLI commands to create a new AKS cluster named **policy-demo** with Azure network plugin enabled:

```shell
az group create --name demo-rg --location australiaeast

az aks create -n policy-demo --node-count 1 --node-vm-size Standard_B2s --load-balancer-sku basic --node-osdisk-size 32 --resource-group demo-rg --generate-ssh-keys --network-plugin azure --network-policy azure

az aks get-credentials --resource-group demo-rg --name policy-demo
```

To test the network policies, I created a simple API that returns the price of a product when you pass the product ID in the parameter as follows:

```shell
curl -X GET http://localhost:8080/price/{product_id}
```

The source code of the API is available [on GitHub](https://github.com/rahulrai-in/prices-api), and the Docker image is available [on DockerHub](https://hub.docker.com/repository/docker/rahulrai/prices-api).

Let's create a Kubernetes deployment and a ClusterIP service (service not visible outside the cluster) for the API using the following manifest:

```yaml
kind: Namespace
apiVersion: v1
metadata:
  name: pricing-ns
  labels:
    name: pricing
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prices-api-deployment
  namespace: pricing-ns
  labels:
    app: prices-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prices-api
  template:
    metadata:
      labels:
        app: prices-api
    spec:
      containers:
        - name: prices-api
          image: rahulrai/prices-api:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "64Mi"
              cpu: "250m"
            limits:
              memory: "128Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: prices-api-service
  namespace: pricing-ns
spec:
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app: prices-api
---
```

Without a network policy in place, any service in the cluster can access the API. To test this, use the following command to create a transient pod in the cluster:

```shell
kubectl run curl-po --image=radial/busyboxplus:curl -i --tty --rm
```

The previous command will give you a shell to the pod. Execute the following command in the shell to access the API:

```shell
curl -X GET prices-api-service.pricing-ns.svc.cluster.local/price/1
```

Let's create another manifest that introduces a network policy to only accept traffic from a pod labeled `app=prices-api-consumer` running in a namespace labeled `project=critical-project` as follows:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: prices-api-network-policy
  namespace: pricing-ns
spec:
  podSelector:
    matchLabels:
      app: prices-api
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              project: critical-project
        - podSelector:
            matchLabels:
              app: prices-api-consumer
```

The network policy starts by defining the pod that it applies to - the Prices API pod. The policy can either restrict the incoming traffic to the pod (Ingress) or the outgoing traffic (Egress). In this case, we want to restrict the incoming traffic to the pod. Next, the policy defines the source of traffic - the API consumer pod. You can read more about the full definition of the Network Policy resource in the [Kubernetes documentation](https://kubernetes.io/docs/concepts/services-networking/network-policies/).

Let's create a namespace as per the network policy specifications in which we will have a transient pod that is allowed to access the API:

```yaml
kind: Namespace
apiVersion: v1
metadata:
  name: critical-project
  labels:
    project: critical-project
```

Let's spin up two transient pods, one that satisfies the network policy - **curl-po-allow** and the other that does not - **curl-po-deny** as follows:

```shell
kubectl run curl-po-allow --image=radial/busyboxplus:curl --labels="app=prices-api-consumer" -i --tty --rm -n critical-project

kubectl run curl-po-deny --image=radial/busyboxplus:curl -i --tty --rm
```

I will execute the previous `curl` command in the shell of both the pods, only one of which will succeed:

{{< img src="1.png" alt="Effect of network policies on pod communication" >}}

Well done on finishing the tutorial on improving the security of your microservices on Kubernetes with Network Policies. The principle of [defense in depth](https://searchapparchitecture.techtarget.com/tip/The-4-rules-of-a-microservices-defense-in-depth-strategy) requires that you consider the level of trust you can accept between microservices. It may be acceptable for microservices to trust each other in some systems but not in others. Most of the time, this tradeoff is driven by convenience. However, it would be best to analyze the implications of a high degree of trust and the vulnerabilities that it can introduce in your architecture.

## Review of Microservices in .NET, Second Edition

I thoroughly enjoyed reading [Microservices in .NET, Second Edition](https://www.manning.com/books/microservices-in-net-second-edition). The tutorial is inspired by the concepts that I learned from the chapter on microservices security.

I found the book very useful for understanding the concepts of microservices and how you can use them to build complex applications. The book not only covers the theory of scoping microservices and the microservices architectural style, but it also covers step-by-step examples of how to implement microservices using MVC Core and ASP.NET Core.

Kubernetes is fast becoming the de-facto platform for hosting microservices, and I am glad that this book covers the necessary features of Kubernetes in the context of microservices.

{{< subscribe >}}
