---
title: Tracing and Profiling A .NET Core Application on Azure Kubernetes Service with a Sidecar Container
date: 2021-01-19
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Imagine running a .NET Core application in Kubernetes which all of a sudden starts behaving erratically and the telemetry fails to give you a complete picture of the issue.

Notes:

1. dotnet new worker -lang C# -n HelloAKS
2. https://giangpham.io/blog/deploying-net-core-worker-service-to-minikube-kubernetes-cluster/
3. https://docs.microsoft.com/en-us/dotnet/core/diagnostics/diagnostics-in-containers

We can get output of trace here:
k cp -n net-worker net-worker-5bb8b565c-gfn65:/tmp/trace.speedscope.speedscope.json trace.speedscope.json

Follow this article: https://medium.com/@matt_89326/debug-asp-net-core-applications-in-kubernetes-with-dotnet-trace-and-speedscope-c43e85827d84

dotnet-trace collect -p 12 --format Speedscope -o /data/

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
