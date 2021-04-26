---
title: Distributed Tracing in ASP.NET Core with Jaeger and Tye Part 1 - Distributed Tracing
date: 2021-04-20
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

https://codemag.com/Article/2010052/Project-Tye-Creating-Microservices-in-a-.NET-Way

https://github.com/dotnet/tye/blob/main/docs/recipes/distributed_tracing.md

https://www.olivercoding.com/2018-12-14-jaeger-csharp/

https://www.c-sharpcorner.com/article/exploring-distributed-tracing-using-asp-net-core-and-jaeger/

> In this series
>
> 1. Distributed Tracing with Jaeger (this article)
> 2. Simplifying the setup with Tye (coming soon)

```shell
dotnet tool install -g Microsoft.Tye --version "0.6.0-alpha.21070.5"
```

```shell
mkdir myweatherapp
cd myweatherapp
dotnet new razor -n frontend
```

## Tye'ing The Services

{{< img src="" alt="" >}}

{{< subscribe >}}
