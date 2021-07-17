---
title: Persistent Volume Management and Expansion in Kubernetes with Azure Kubernetes Service
date: 2021-07-17
tags:
  - azure
  - kubernetes
comment_id: 4dab8e2d-deb4-450b-a9d5-9071c7e164e2
---

Applications or databases running out of disk space are a common issue that the Operations team addresses regularly. This problem has existed since the days we used to host applications on bare metal servers and is still present in virtualized and container environments. However, since we have reached a stage where the compute and storage systems are decoupled from each other, granting additional storage to applications rarely requires updating the application or modifying the underlying application host infrastructure.

This article will discuss how we can use [Azure Disk](https://docs.microsoft.com/en-us/azure/virtual-machines/managed-disks-overview) as an expandable storage medium for your applications running in Kubernetes. Following is a brief overview of the activities we will cover in this article:

1. Create Azure Kubernetes Service cluster.
2. Create Azure Disk and a Persistent Volume (PV).
3. Create a Persistent Volume Claim (PVC) for the application.
4. Resize the Persistent Volume Claim.
5. Test the application.

Kubernetes volumes can be created in two modes as follows:

1. Static: In this mode, the volume is created manually and referenced using the Pod specification.
2. Dynamic: In this mode, the volume is created automatically by AKS and referenced using a Persistent Volume Claim specification.

To learn more about Kubernetes persistent volumes, please refer to the [guide on storage options for application on AKS](https://docs.microsoft.com/en-us/azure/aks/concepts-storage).

## No Separation of Concerns with Static Persistent Volumes

The static persistent volumes are created using a Pod specification similar to the following:

```yaml
volumes:
  - name: azure
      azureDisk:
        kind: Managed
        diskName: aksDisk
        diskURI: /subscriptions/<subscriptionID>/resourceGroups/MC_myAKSCluster_myAKSCluster_eastus/providers/Microsoft.Compute/disks/aksDisk
```

The previous specification has two problems:

1. The developers need to know the name and path to the backing storage medium.
2. The developer can't request a limited storage size and expand it later on demand.

We can address these issues by adding an indirection using `PersistentVolume` and `PersistentVolumeClaim` objects. By using the objects, we can decouple the management of the storage medium from its usage as follows:

1. Developers can request persistent storage for their application using a `PersistentVolumeClaim` specification.
2. The Operations team can manage the creation and management of the storage medium, e.g., Azure Disk.

## Cluster Setup

We will use the [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) to create and manage our Kubernetes cluster.

Use the following command to create a resource group and an AKS cluster:

```shell
az group create --name demo-rg --location australiaeast

az aks create -n pv-demo --node-count 1 --node-vm-size Standard_B2s --load-balancer-sku basic --node-osdisk-size 32 --resource-group demo-rg --generate-ssh-keys

az aks get-credentials --resource-group demo-rg --name pv-demo
```

## Create Azure Disk for Persistent Storage

AKS can use Azure Disks or Azure Files as data volumes. In this example, we will use Azure Disks as the storage medium.

You must create your Azure Disk instance in the resource group that contains the nodes of your AKS cluster. Since AKS has permission to manage all the resources in that resource group, we don't need to explicitly grant access to any resources in the resource group. Execute the following command to fetch the name of the node resource group:

```shell
AKS_NODE_RG=$(az aks show --resource-group demo-rg --name pv-demo --query nodeResourceGroup -o tsv)
```

Next, create an Azure Disk in the resource group. Record the ID of the Azure Disk that was created from the output of the following command:

```shell
az disk create --resource-group $AKS_NODE_RG --location "australiaeast" --sku "Standard_LRS" --name "aksDisk" --size-gb "10" --query id --output tsv
```

## Create Persistent Volume and Persistent Volume Claim

The next responsibility of the Operations team after creating the Azure Disk is to create a [storage class](https://kubernetes.io/docs/concepts/storage/storage-classes) that defines the storage medium we will make available to the cluster as follows:

```shell
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: static-disk
provisioner: kubernetes.io/azure-disk
volumeBindingMode: WaitForFirstConsumer # Default is Immediate, recommended is WaitForFirstConsumer
allowVolumeExpansion: true # Allows the user to increase PVC request size later
EOF
```

A key feature of the storage class specification is the `allowVolumeExpansion` attribute that determines whether a user can increase the storage size of an existing persistent volume claim. In this example, we will try to change the initially requested capacity of a PVC to enable the user to expand the storage on demand. I will talk about the importance of volume expansion in detail later in this article.

Let's now create a Persistent Volume based on the storage class and the Azure Disk that was created earlier:

```shell
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolume
metadata:
  name: azure-disk-pv
spec:
  capacity:
    storage: 10Gi
  storageClassName: static-disk
  volumeMode: Filesystem
  accessModes:
    - ReadWriteOnce
  azureDisk:
    kind: Managed
    diskName: aksDisk
    diskURI: /subscriptions/<subscriptionID>/resourceGroups/MC_demo-rg_pv-demo_australiaeast/providers/Microsoft.Compute/disks/aksDisk
EOF
```

There are a few noteworthy attributes of the `PersistentVolume` object we created:

1. The capacity `spec.capacity.storage` is the same as the size of the disk that we created.
2. We specified the Azure Disk info in the `spec.azureDisk` attribute.

Let's now create a Persistent Volume Claim (PVC) to request 10 GB storage from the PV linked to the storage class we created in the previous step:

```shell
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: azure-disk-pvc
spec:
  storageClassName: static-disk
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
EOF
```

## Create a Pod Linked to the Persistent Volume Claim

Finally, we need a Pod that uses the PVC so that the PV and PVC get bound to each other. Following is a simple Pod specification that uses the PVC we created in the previous step:

```shell
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  volumes:
    - name: mypod-storage
      persistentVolumeClaim:
        claimName: azure-disk-pvc
  containers:
    - name: frontend
      image: nginx
      ports:
        - containerPort: 80
          name: "http-server"
      volumeMounts:
        - mountPath: "/usr/share/nginx/html"
          name: mypod-storage
EOF
```

Let's now check the status of the Persistent Volume and the Persistent Volume Claim with the following commands:

```shell
kubectl get pvc/azure-disk-pvc

kubectl get pv/azure-disk-pv
```

Note the values in the `Status` columns of the output of the previous commands. It indicates that the PV and PVC are bound to each other.

{{< img src="1.png" alt="PV and PVC are bound to each other" >}}

Let's now add a file to the volume mounted on the Pod and try to access it via that NGINX application running on the Pod. First, get a shell to the container running in your Pod with the following command:

```shell
kubectl exec -it mypod -- /bin/bash
```

Next, write custom text to the `index.html` file served by NGINX with the following command:

```shell
sh -c "echo 'Hello from Kubernetes storage' > /usr/share/nginx/html/index.html"
```

Note the path of the `index.html` file, which resides in a directory in our PV. NGINX will serve the file to the client at http://localhost/. Next, execute the following command from the container shell to send a request to the endpoint.

```shell
$ curl http://localhost/

Hello from Kubernetes storage
```

Following is the screenshot of the output of the previous command:

{{< img src="2.png" alt="Response from NGINX" >}}

Let's also find out the size of the mounted volume with the following command (10 GB currently):

```shell
$ df -k /usr/share/nginx/html/

Filesystem     1K-blocks  Used Available Use% Mounted on
/dev/sdc        10255636 36892  10202360   1% /usr/share/nginx/html
```

Following is the screenshot of the output of the previous command:

{{< img src="3.png" alt="Size of the mounted volume" >}}

Why is the ability to resize a volume important in Kubernetes? The answer to the question begins with the actions Kubernetes will take when your application runs out of disk space.

### Effects of Disk Pressure on Applications in Kubernetes

Kubernetes will kill Pods when they breach a resource threshold to reclaim the starved resource. A Kubelet constantly monitors the available node memory, disk, and process ids (PIDs). When the Pods on the node lead to a breach of the resource thresholds, the kubelet executes a Garbage Collector routine to reclaim resources from dead Pods and containers. If the pressure continues to exist, the kubelet starts evicting Pods that consume more resources than requested.

We will restrict our discussion to Node disk pressure in this article. High disk pressure indicates that a node is using too much disk space or is filling the disk space too fast, according to the thresholds set by you or the defaults in the Kubernetes configuration. Disk pressure is an important metric to monitor because it might mean that you need to add more disk space if your application legitimately needs more space. Or it might mean that an application is suffering from memory leaks and filling up the disk prematurely in an unanticipated manner.

To keep the application running before the developers and Operations fix the underlying issue, you can expand the disk space available to the Pod by expanding the mounted persistent volume. The [Kubernetes blog post on dynamically expanding volumes](https://kubernetes.io/blog/2018/08/02/dynamically-expand-volume-with-csi-and-kubernetes/) outlines the steps for the process.

## Resizing Persistent Volume Claim

Since our storage class supports volume resizing, we need to ask for more space by increasing (decreasing capacity is not permitted) the requested disk space as follows:

```shell
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: azure-disk-pvc
spec:
  storageClassName: static-disk
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi
EOF
```

You must recreate the Pod so that the changes can take effect. Azure Disks can't be resized if they are attached to a Pod. For applications that demand high availability, you should use Azure Files as Persistent Volume as they don't have this limitation. In this case, we will delete the Pod, resize the disk, and recreate the Pod as follows:

```shell
kubectl delete pod mypod

az disk update --resource-group $AKS_NODE_RG --name aksDisk --size-gb 20

cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  volumes:
    - name: mypod-storage
      persistentVolumeClaim:
        claimName: azure-disk-pvc
  containers:
    - name: frontend
      image: nginx
      ports:
        - containerPort: 80
          name: "http-server"
      volumeMounts:
        - mountPath: "/usr/share/nginx/html"
          name: mypod-storage
EOF
```

Use the previous set of instructions to get a shell to the container running in your Pod and get the available size of the mounted volume. The following screenshot shows the output of the operation:

{{< img src="4.png" alt="Resized volume" >}}

To save costs, remember to delete all the resources used in this exercise with the following command:

```shell
az group delete --name demo-rg --yes --no-wait
```

## Conclusion

We discussed utilizing Kubernetes persistent volumes to store data in Azure. We saw how the default implementation of specifying persistent volume details in the Pod specification breaks the separation of concerns. We also discussed the need to resize volume when the application is running out of disk space.

We addressed the separation of concerns problem by adding indirection with Persistent Volume and Persistent Volume Claim objects. We used a Storage Class and Persistent Volume Claim to increase the size of the volume dynamically.

I hope you enjoyed reading this article. I will be happy to hear your feedback and questions on [Twitter](https://twitter.com/intent/user?screen_name=rahulrai_in) or in the comments section below.

{{< subscribe >}}
