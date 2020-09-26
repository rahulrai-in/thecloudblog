---
title: Enable TLS on HTTP Triggered Function App in Kubernetes Using KEDA and NGINX
date: 2020-09-26
tags:
  - azure
  - kubernetes
comment_id: fe4ecd2e-27b5-41bf-b301-b3a498e73885
---

With [KEDA](https://keda.sh/) (Kubernetes-based Event-Driven Autoscaling), you can host Azure Functions on Kubernetes. KEDA allows you to scale pods based on configurable rules that rely on metrics from data sources such as Azure Queue. The [Microsoft documentation](https://docs.microsoft.com/en-us/azure/azure-functions/functions-kubernetes-keda) outlines how you can use the Prometheus scaler to scale HTTP triggered Azure functions. However, it does not discuss the the security of the transport channel in detail. This quick tip will demonstrate how you can expose your HTTP triggered Azure Functions over TLS/SSL (HTTPS endpoint). Most of the steps documented in this article are the same as the ones [mentioned in this article](https://dev.to/anirudhgarg_99/scale-up-and-down-a-http-triggered-function-app-in-kubernetes-using-keda-4m42). The scope of this article/tip is limited to securing the transport channel with TLS/SSL. In contrast, the other article demonstrates how you can configure auto-scaling on Azure Functions in Kubernetes.

## Overview

The plan of action is straightforward. We will use NGINX Ingress Controller to terminate TLS/SSL at the ingress and transfer traffic in plain text to our Azure Function application. We will now discuss the steps involved in doing so.

## Create an AKS Cluster

From your cloud shell, execute the following command to create a low-cost AKS cluster and set the default kubectl context. Choose another name for your cluster in case the one mentioned in the following command is not available.

```cmd
az group create --name aks-fx-demo-rg --location australiaeast
az aks create -n aks-fx-demo --node-count 1 --node-vm-size Standard_B2s --load-balancer-sku basic --node-osdisk-size 32 --resource-group aks-fx-demo-rg --generate-ssh-keys
az aks get-credentials --resource-group aks-fx-demo-rg --name aks-fx-demo
```

After the command succeeds, let's now deploy an HTTP triggered function to our cluster.

## Create an HTTP Triggered Function

Execute the following commands that will create an HTTP Triggered Azure Function and add a Dockerfile to it. We will use the default Function template without modifying its contents for this demo.

```cmd
func init --worker-runtime dotnet
func new --template "HttpTrigger" --name echo
func init --docker-only
```

The next command that we are going to execute is a beast. It will first build a container image using the Dockerfile that you added using the previous command. Next, it will upload the generated image to DockerHub (can be configured to use [Azure Container Registry](https://docs.microsoft.com/en-us/azure/container-registry/)), and deploy the function app as a service of type ClusterIP to AKS. Before executing the following command, make sure that you are logged in to DockerHub (`docker login`) and change the name of the registry in the command.

```cmd
func kubernetes deploy --name echo-aks-fx --namespace echo --service-type ClusterIP --registry rahulrai
```

Since our Azure Function app is deployed as a ClusterIP service, it is not exposed to the internet yet. Let's change that by installing the NGINX ingress controller in our cluster with [Helm](https://helm.sh/docs/intro/install/). It is a good practice to avoid the default namespace for custom deployments, and hence, I will deploy the NGINX ingress controller in a namespace named **nginx**.

```shell
kubectl create namespace nginx
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx --namespace nginx --set controller.replicaCount=2 --set controller.nodeSelector."beta\.kubernetes\.io/os"=linux --set defaultBackend.nodeSelector."beta\.kubernetes\.io/os"=linux
kubectl --namespace nginx get services -o wide -w nginx-ingress-ingress-nginx-controller
```

The last command in the previous code listing will give you the external IP address of the ingress controller you created. Please note it because you would be able to access your app on that IP address. You can configure NGINX to read TLS certificates from a Kubernetes secret. Let's now create a TLS certificate and store it as a secret in our cluster.

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 -out aks-ingress-tls.crt -keyout aks-ingress-tls.key -subj "/CN=echo-aks-fx.azure.com/O=aks-ingress-tls"

kubectl create secret tls nginx --namespace ingress-basic --key aks-ingress-tls.key --cert aks-ingress-tls.crt
```

Finally, let's configure NGINX to use the TLS certificate that we just created for securing the transport and direct the traffic to our Azure Function after terminating SSL at the ingress controller. Execute the following command to create an NGINX ingress controller that fulfills the two responsibilities.

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

After successfully executing the previous commands, we are now ready to access our Function app over a secure channel. Execute the following command after replacing the IP address with the one you received from the previous command's output.

```cmd
curl -k --resolve echo-aks-fx.azure.com:443:104.210.80.142 https://echo-aks-fx.azure.com/api/echo?name=JohnDoe
```

The following screenshot presents the output that I received from the Function app on my cluster on executing the previous command.

{{< img src="1.png" alt="Output from Function app" >}}

In the previous request, we pinned the hostname to the static IP address of the NGINX ingress controller. You can configure your DNS server to map a valid hostname to the ingress controller's IP address by setting the proper [A name record](https://www.cloudflare.com/learning/dns/dns-records/dns-a-record/). For further information regarding automatic scaling of the Function app with KEDA, refer to the [guidance from Microsoft](https://docs.microsoft.com/en-us/azure/azure-functions/functions-kubernetes-keda).

{{< subscribe >}}
