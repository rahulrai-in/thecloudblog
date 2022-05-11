---
title: Managing Applications in Kubernetes with the Carvel Kapp Controller
date: 2022-05-06
tags:
  - kubernetes
comment_id: 2dc28891-11cc-4385-879c-952a97075c56
---

Any typical enterprise-grade application deployed on Kubernetes comprises several API resources that need to be deployed together. For example, the [WordPress application](https://github.com/kubernetes/examples/blob/master/mysql-wordpress-pd), which is one of the example applications available on the Kubernetes GitHub repository, includes:

- a `wordpress` frontend pod
- a `wp-pv-claim` persistent volume claim mounted to the frontend pod
- a `wordpress-mysql` MySQL database pod
- a `mysql-pv-claim` persistent volume claim mounted to the MySQL database pod
- two persistent volumes: `wordpress-pv-1` and `wordpress-pv-2` to serve the persistent volume claims
- services for the database and frontend pods

Application (or app) is not a native construct in Kubernetes. However, managing applications is the primary concern of the developers and operations. Application delivery on Kubernetes involves upgrading, downgrading, and customizing the individual API resources. Kubernetes allows you to restrict the spread of your application resources through `namespaces` such that you can deploy an entire app in a namespace that can be deleted or created. However, a complex application might consist of resources spread across namespaces, and in such cases answering the following questions might be a challenge:

- How many apps are running in a namespace?
- Was the upgrade of all the resources of the app successful?
- Which types of resources are associated with my app?

## The kapp Tool

The [kapp (Kubernetes App)](https://carvel.dev/kapp/) tool is one of the tools available in the [Carvel toolkit](https://github.com/vmware-tanzu/carvel). kapp enables users to group a set of resources (resources with the same label) as an application. Furthermore, kapp manages the individual resources of the application so that the users only have to operate at the level of applications through the kapp CLI.

> [Helm](https://helm.sh/) (specifically Helm3) is an alternative to the kapp tool. Just like Helm, kapp can perform a stateful upgrade of the application. However, Kapp does not have templating capabilities like Helm, a capability that is fulfilled by the [YTT](https://get-ytt.io/) tool in the Carvel toolkit. By combining kapp with the kapp-controller, you can build neat GitOps workflows, which takes it far beyond the capabilities of Helm.

To understand kapp better, let's install it on our system with the following command:

```shell
wget -O- https://carvel.dev/install.sh > install.sh
sudo bash install.sh
```

The previous command will install all the tools of the Carvel toolkit, such as YTTl, imgpkg, etc., on your system. Please explore the usage of these tools on your own. Each tool of the Carvel toolkit is independent and takes little space on your system.

I wrote a [simple .NET application](https://github.com/rahulrai-in/azure-voting-app-dotnet) that includes a frontend and a Redis database that we will use for testing kapp. Please feel free to use the application for your demos or learning purposes. You can use the [all-in-one.yaml](https://github.com/rahulrai-in/azure-voting-app-dotnet/blob/main/kubernetes-manifests/all-in-one.yaml) manifest to install all the components of the application to your cluster. Let's now use kapp to install the components in the form of an application named **az-vote**.

```shell
kapp deploy --app=az-vote -f https://raw.githubusercontent.com/rahulrai-in/azure-voting-app-dotnet/main/kubernetes-manifests/all-in-one.yaml
```

On executing the command, you will see the list of the components that kapp will create as follows:

{{< img src="1.png" alt="List of changes identified by kapp" >}}

If you type "y", kapp will annotate your resources to link them to the app and later manage them. Based on the difference between the actual and desired state, it will upgrade or delete resources and give you the overall status of your app. The following screenshot shows the annotations added by kapp to the pods of the application:

{{< img src="2.png" alt="Labels applied by kapp" >}}

You can view the applications in the cluster using the `kapp list` command as follows:

{{< img src="3.png" alt="List apps in the cluster" >}}

To view the list of resources that make up the application, use the `kapp inspect` command as follows:

{{< img src="4.png" alt="Inspect app" >}}

You will notice that some of the objects such as `Endpoints` and `EndpointSlices` that Kubernetes creates under the hood when you define a `Service` are included in the command output. The output format makes it easy to read the success and failure states of all the application resources.

We will now introduce the kapp-controller to automate the deployment of the application. However, before we do so, delete the application by running the following command:

```shell
kapp delete --app=az-vote
```

## The kapp-controller

When you bundle your application as a set of atomically managed resources with well-defined names (e.g., the components of the Azure Vote App), you somewhat build a [CustomResourceDefinition (CRD)](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources). CRDs are often used by Kubernetes operators that enable Kubernetes to act in the "right" way when the resources are created, destroyed, or updated. In fact, you can already find several CRDs installed on your Kubernetes clusters, which can be listed by using the `kubectl get crd` command.

The [kapp-controller](https://carvel.dev/kapp-controller/) tool takes a kapp application and augments it with automation capabilities such as GitOps. The tool allows you to build a fully automated application platform that can automatically deploy and manage 100s of applications without requiring any manual or automated input. Tools such as Helm and kapp-controller eliminate the need to build operators to manage the lifecycle of most of the business applications which don't need to interact with the Kubernetes API.

Let's install kapp-controller to the cluster by using kapp itself as follows:

```shell
kapp deploy -a kc -f https://github.com/vmware-tanzu/carvel-kapp-controller/releases/latest/download/release.yml
kapp deploy -a default-ns-rbac -f https://raw.githubusercontent.com/vmware-tanzu/carvel-kapp-controller/develop/examples/rbac/default-ns.yml
```

The first command installs the kapp-controller as an application on the cluster. The second command creates an RBAC rule to give complete control of the `default` namespace to the kapp-controller. The permissions enable the kapp-controller to create, update, and delete Kubernetes resources in the namespace.

Now that our kapp-controller is running in the cluster, we can use it to automatically deploy our application from the specs available in our Git repository. To do so, we will create a `kapp` CR to define our application. The `kapp` CR is well understood by the kapp-controller. The specification format of a `kapp` application is available on the [Carvel docs website](https://carvel.dev/kapp-controller/docs/v0.36.1/app-spec/).

Create an application specification for the Azure Vote App, which will run as a fully kapp controlled application as follows:

```yaml
apiVersion: kappctrl.k14s.io/v1alpha1
kind: App
metadata:
  name: azure-vote-app
  namespace: default
spec:
  serviceAccountName: default-ns-sa
  fetch:
    - git:
        url: https://github.com/rahulrai-in/azure-voting-app-dotnet
        ref: origin/main
        subPath: kubernetes-manifests/
  template:
    - ytt: {}
  deploy:
    - kapp: {}
```

Pulling the application specs from Git is one of the supported ways to create an application. You can also instruct the kapp-controller to fetch the application specs from an HTTP location, a Helm chart, a container registry, etc. By default, the kapp-controller will check the source of the application (HTTP location, Helm chart, etc.) every minute and try to reconcile the state of the application in the cluster with the state specified in the source.

Deploy the application to the cluster by running the command `kubectl apply -f <app-spec-file>`. Afterward, run the `kapp list` command to list the apps in your cluster as follows:

{{< img src="5.png" alt="List of apps in the cluster" >}}

Let's inspect the resources of the application as follows:

{{< img src="6.png" alt="List of resources of the azure-vote-app-ctrl app" >}}

We have now integrated our application into a CI/CD system that can be managed entirely inside Kubernetes. We can now assign the responsibility to submit and maintain the CRDs for the applications to the developers and let the kapp controller operator deploy and manage the applications in the default namespace.

The kapp-controller installed the CRDs for the kapp applications in the cluster for us, which now enable us to use `kubectl` commands to manipulate the applications just like other native Kubernetes objects as follows:

{{< img src="7.png" alt="Use kubectl with kapp" >}}

## Conclusion

We worked with two of the most popular tools of the Carvel toolkit: kapp, and kapp-controller, which help us work with applications instead of their individual components. In addition, we noted that the kapp-controller can help us package our applications in a stateful manner without requiring us to write any custom operators. Finally, we used the kapp tools to implement an operator-like deployment model of the Azure Vote App and realized that the kapp-controller can provide most of the benefits of the operators in a fraction of the time it takes to implement an operator.

## Review of Core Kubernetes by Manning

This article is inspired by the chapter "Installing applications" of the book [Core Kubernetes by Manning](https://www.manning.com/books/core-kubernetes).

Understanding the Kubernetes and the cloud-native landscape requires a good understanding of the key concepts such as Pods, CNIs, DNS, Etcd, etc. This book caters to a wide variety of readers, both novice and seasoned professionals. I liked that each chapter of the book is independent of the others, which allows you to start this book from anywhere or read it in whatever sequence you want. I am delighted by how the details in every chapter are laid out. Every chapter starts by explaining a concept and its need and then uses examples to explain the concept in great detail. For example, the chapter on DNS begins by explaining the need for DNS and then shows how the pod uses the `resolv.conf` file to reach the CoreDNS nameserver. It then presents a hands-on example of how to configure the CoreDNS service. Once you have finished reading the chapter, you will have a thorough understanding of the DNS service in Kubernetes.

If you love cloud-native technologies, you will definitely enjoy reading this book.

{{< subscribe >}}
