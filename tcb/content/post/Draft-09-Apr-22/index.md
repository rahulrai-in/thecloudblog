---
title: Managing Applications in Kubernetes with Carvel Kapp Controller
date: 2022-04-09
tags:
  - kubernetes
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Any typical enterprise grade application deployed on Kubernetes is made up of several API resources that need to be deployed together. For example, the [Wordpress application](https://github.com/kubernetes/examples/blob/master/mysql-wordpress-pd) avaialble as one of the example applications on Kubernetes GitHub repository includes:

- a `wordpress` frontend pod
- a `wp-pv-claim` persistent volume claim mounted to the frontend pod
- a `wordpress-mysql` MySQL database pod
- a `mysql-pv-claim` persistent volume claim mounted to the MySQL database pod
- two persistent volumes: `wordpress-pv-1` and `wordpress-pv-2` to serve the persistent volume claims
- services for the database and frontend pods

Application (or app) are not a native construct in Kubernetes. However, managing applicattions is the primary concern of the developers and operations. Application delivery on Kubernetes involves upgrading, downgrading, and customizing the individual API resources. Kubernetes allows you to restrct the spread of your application resources through `namespaces` such that you can deploy an entire app in a namespace which can be deleted or created. However, a complex application might consist of resources spread across namespaces and in such cases answering the following questions might be a challenge:

- How many apps are running in a namespace?
- Was the upgrade of all the resources of the app successful?
- Which types of resources are associated with my app?

## The kapp Tool

The [kapp (Kubernetes App)](https://carvel.dev/kapp/) tool is one of the tools available in the Carvel toolkit. The kapp CLI allows users to manage resources in bulk

> [Helm](https://helm.sh/) (specifically Helm3) is an alternative to the kapp tool. Just like Helm, kapp can perform a stateful upgrade of the application. Kapp does not have templating capabilities like Helm, a capability that is fulfilled by the [YTT](https://get-ytt.io/) tool in Carvel toolkit. When kapp is combined with the kapp-controller, you can build great GitOps workflows which takes it far beyond the capabilities of Helm.

Install kapp:
Install kapp-controller: https://carvel.dev/kapp-controller/

Add service account to allow kapp to deploy apps in default ns: kapp deploy -a default-ns-rbac -f https://raw.githubusercontent.com/vmware-tanzu/carvel-kapp-controller/develop/examples/rbac/default-ns.yml https://carvel.dev/kapp-controller/

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
        subPath: kubernetes-manifests
  template:
    - ytt: {}
  deploy:
    - kapp: {}
```

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}

https://livebook.manning.com/book/core-kubernetes/chapter-15/v-5/6
