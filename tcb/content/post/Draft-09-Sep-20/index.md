---
title: "Dynamic Admission Control in AKS with Azure Functions"
date: 2020-09-09T14:38:52+10:00
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Controlling resource deployments in your [Azure Kubernetes Service (AKS)](https://azure.microsoft.com/en-au/services/kubernetes-service/) cluster can become a difficult challenge. For instance, pushing changes to a production environment might introduce undesirable vulnerabilities to the application. By creating custom admission webhooks for Kubernetes, we can define custom policies that regulate the deployment of resoures to our cluster. The Kubernetes ecosystem is not completely devoid of solutions that you can use to govern the resources on your cluster. [OPA Gatekeeper](https://github.com/open-policy-agent/gatekeeper) is one such solution that is used to enforce policies on a Kubernetes cluster. [Azure Policy](https://docs.microsoft.com/en-us/azure/governance/policy/concepts/policy-for-kubernetes) for Azure Kuberntes Service (AKS) extends the Gatekeeper to apply policies on your cluster in a centralized and consistent manner. The Gatekeeper and hence Azure Policy are built using the admission webhook feature of the Kubernetes.

You can install Azure Policy as an extension to AKS. It has several [in-built policies](https://docs.microsoft.com/en-us/azure/governance/policy/samples/built-in-policies#kubernetes) that you can simply enable on your cluster. An example of such a policy is to enforce pods to only listen to an allowed list of ports. I have spoken about admission webhooks twice now. Let's understand it in detail.

## Dynamic Admission Control

Kubernetes version 1.9 introduced two code packages that allow you to write custom admission plugins: ValidatingAdmissionWebhook and MutatingAdmissionWebhook. These plugins give you a great deal of flexibility to integrate directly into the resource admission process. An admission webhook\controller is a piece of code that in invoked by the Kubernetes API server intercepts requests to the Kubernetes API prior to persistence of the object, but after the request is authenticated and authorized. Several admission controllers are built into Kubernetes and cover a range of functionality. One such admission controller is `namespace exists` that throws an error if you attempt to create a resource in a namespace that does not exist.

Gatekepper and hence Azure Policy are simply Validating Admission Webhooks that intercepts every request to create or update a Kubernetes object and accepts or rejects the request based on whether it meets the specified constraints.

## Making Dynamic Admission Control Serverless

Azure Policy is the clean and recommeded approach to emforcing constraints on your AKS cluster. There might be scenarios where you want to build custom admissin webhooks to enforce regulations to launch only approved resources in your cluster. I recently presented at the [Serverless Days ANZ](https://anz.serverlessdays.io/) on how you can can implement the webhooks using Azure Functions, which gives you the ability to scale the deployment certification process and also enables you to take advatage of built in bindings to connect services without writing a single line of code.

In the session I covered one such scenario in which I wrote a validating admission webhook with Azure Functions and applied custom governance policies on the deployments in Kubernetes. I also used the native Azure Function Twilio binding to send SMS updates to SRE\Ops teams informing them whether the deployment failed or succeeded. I recommend that you wantch this session to understand how easy it is to write custom validating webhooks for Kubernetes. I am sure, once you read see how easy it is to write such policies, you would want to automate your existing organizational deployment policies and certify deployments at scale in Kubernetes.

{YT Link}

Although the approach to use an extneral serverless service works well with EKS, or GKE, it doesn't work with AKS. The admission controllerers are part of the Kubernetes API server, which is managed by Azure. Firewall policies in Azure do not allow the API server to access to external HTTP endpoints. However, it does allow the API server to communicate with services in the cluster. As you saw in the video, that we could not use the token based security features of Azure functions. By routing traffic to an Admission control serverless function through a service running within the cluster, you can not only implement whatever security measure that you like, you can also implement custom policies within your service itself. Even if you are using 

## Reverse Proxy




## Azure Functions in AKS with KEDA

From your cloud shell, execute the following command to create a low cost AKS cluster. Choose another name for your cluster in case the one below is not available.

```cmd
az group create --name dac-demo-rg --location australiaeast
az aks create -n dac-demo --node-count 1 --node-vm-size Standard_B2s --load-balancer-sku basic --node-osdisk-size 32 --resource-group dac-demo-rg --generate-ssh-keys
az aks get-credentials --resource-group dac-demo-rg --name dac-demo
```

Install nginx ingress

```
kubectl create namespace dac-demo

helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx

helm install nginx-ingress ingress-nginx/ingress-nginx --namespace dac-demo --set controller.replicaCount=2 --set controller.nodeSelector."beta\.kubernetes\.io/os"=linux --set defaultBackend.nodeSelector."beta\.kubernetes\.io/os"=linux


kubectl --namespace dac-demo get services -o wide -w nginx-ingress-ingress-nginx-controller

```

Gen certificate

```
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -out aks-ingress-tls.crt -keyout aks-ingress-tls.key -subj "/CN=dac-demo.azure.com/O=aks-ingress-tls"

kubectl create secret tls aks-ingress-tls --namespace ingress-basic --key aks-ingress-tls.key --cert aks-ingress-tls.crt
```

The source code of the sample contains

- az account set --subscription e52e2632-880e-46d4-a7ef-0d772704f544
- Install KEDA https://keda.sh/docs/1.4/deploy/
- Instructions here https://docs.microsoft.com/en-us/azure/azure-functions/functions-kubernetes-keda
- Image available here: rahulrai/az-fx-k8s-dac:latest
- // func kubernetes deploy --name az-fx-k8s-dac --registry rahulrai
- func kubernetes deploy --name az-fx-k8s-dac --namespace dac-demo --service-type ClusterIP --registry rahulrai

Operaion will get time out waiting for a Load Balancer IP address, which will not get assigned to it since it is a CLusterIP service. Let's expose the service to the internet now.

kubectl apply -f nginx-ingress.yaml

curl -v -k --resolve dac-demo.azure.com:443:52.187.244.171 https://dac-demo.azure.com/dac/api/AdmissionControlFx

Let's now add a validation controller

---

Crap I did the wrong thing. We don't need to expose function externally. Let's switch to using it as service.

Testing Linkerd

openssl req -x509 -nodes -newkey rsa:2048 -config openssl.cnf \
 -subj '/C=US/CN=My CA' -keyout certificates/private/cakey.pem \
 -out certificates/cacertificate.pem

```
kubectl -n kube-system create secret generic objectstore-cert --from-file=/opt/certs/

```

---

Change to golang proxy server

https://banzaicloud.com/blog/k8s-admission-webhooks/

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
