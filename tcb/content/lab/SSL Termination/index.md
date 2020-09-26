---
title: Secure
date: 2020-09-23
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

With KEDA (Kubernetes-based Event Driven Autoscaling), you can host Azure Functions on Kubernetes. KEDA allows you to scale pods based on preconfigured rules that rely on metrics from a data sources such as Azure Queue. The [Microsoft documentaiton](https://docs.microsoft.com/en-us/azure/azure-functions/functions-kubernetes-keda) outlines how you can use the Prometheus scaler to scale HTTP triggered Azure functions. However, it does not discuss the aspect of security of the trasnport channel in detail. In this quick tip, I will demonstrate how you can expose your HTTP triggered Azure Functions over TLS/SSL (HTTPS endpoint). Most of the steps documented in this article are the same as the ones [mentioned in this article](https://dev.to/anirudhgarg_99/scale-up-and-down-a-http-triggered-function-app-in-kubernetes-using-keda-4m42). The scope of this article/tip is limited to securing the transport channel with TLS/SSL, whereas the other article demonstrates how you can configure auto scaling on the Azure Function.

## Overview

The plan of action is really simple. We will use NGINX Ingress Controller to terminate TLS/SSL at the Ingress. After terminating TLS/SSL, NGINX will transfer traffic to our Azure Function service.

## Create AKS CLuster

From your cloud shell, execute the following command to create a low cost AKS cluster and set the default kubectl context. Choose another name for your cluster in case the one below is not available.

```cmd
az group create --name aks-fx-demo-rg --location australiaeast
az aks create -n aks-fx-demo --node-count 1 --node-vm-size Standard_B2s --load-balancer-sku basic --node-osdisk-size 32 --resource-group aks-fx-demo-rg --generate-ssh-keys
az aks get-credentials --resource-group aks-fx-demo-rg --name aks-fx-demo
```

Let's now deploy an HTTP triggered function to our cluster

## Create HTTP Triggered Function

Execute the following commands to create an HTTP Triggered Azure Function and adds a Dockerfile to it. We will use the default Function template without modifying its contents.

```cmd
func init --worker-runtime dotnet
func new --template "HttpTrigger" --name echo
func init --docker-only
```

Execute the following command to build the container image, upload the image to DockerHub, and deploy the function to AKS. You can also change the name of the registry to make it reference your ACR (Azure Container Registry) instance. Make sure that you are logged in to to DockerHub (`docker login`) and change the name of the registry before executing the following command.

```cmd
func kubernetes deploy --name echo-aks-fx --namespace echo --service-type ClusterIP --registry rahulrai
```

Since our Azure Function is deployed as a service of type ClusterIP, it is not exposed to the internet yet. Let's change that by installing NGINX ingress controller through Helm. It is a good practice to avoid the default namespace for custom deployments and hence, I will deploy the NGINX ingress controller in a namespace named **nginx**.

```
kubectl create namespace nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx --namespace nginx --set controller.replicaCount=2 --set controller.nodeSelector."beta\.kubernetes\.io/os"=linux --set defaultBackend.nodeSelector."beta\.kubernetes\.io/os"=linux
kubectl --namespace nginx get services -o wide -w nginx-ingress-ingress-nginx-controller
```

The last command in the previous code listing will give you the external IP address of the ingress controller that you created. You can configure NGINX to read TLS certificates from a Kubernetes secret. Let's now create a TLS certificate and stre it as a secret.

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -out aks-ingress-tls.crt -keyout aks-ingress-tls.key -subj "/CN=echo-aks-fx.azure.com/O=aks-ingress-tls"

kubectl create secret tls nginx --namespace ingress-basic --key aks-ingress-tls.key --cert aks-ingress-tls.crt
```

Finally, let's configure NGINX to use the TLS certificate that we just created and direct traffic to our Azure Function. Execute the following command to do so.

```bash
cat << EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1beta1
kind: Ingress
metadata:
  name: nginx-ingress
  namespace: echo
  annotations:
    kubernetes.io/ingress.class: nginx
spec:
  tls:
  - hosts:
    - echo-aks-fx.azure.com
    secretName: aks-ingress-tls
  rules:
  - host: echo-aks-fx.azure.com
    http:
      paths:
      - backend:
          serviceName: echo-aks-fx-http
          servicePort: 80
        path: /
EOF
```

Everything is up and running now. Let's send a request to our function now. Execute the following command after replacing the IP address

```
curl -k --resolve echo-aks-fx.azure.com:443:104.210.80.142 https://echo-aks-fx.azure.com/api/echo?name=JohnDoe
```

{{< img src="1.png" alt="Output" >}}

{{< subscribe >}}
