---
title: Distributed Tracing in ASP.NET Core with Jaeger and Tye Part 2 - Project Tye
date: 2021-05-06
tags:
  - azure
  - programming
  - web
draft: true
comment_id: 5f9dadf3-0894-4d6d-8b3f-efa5183e43f9
---

> In this series
>
> 1. [Distributed Tracing with Jaeger](/post/distributed-tracing-in-asp.net-core-with-jaeger-and-tye-part-1-distributed-tracing/)
> 2. Simplifying the setup with Tye (this article)

## Source Code

You can download the source code of the demo application from my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/dcalculator" >}}

#```shell
dotnet tool install -g Microsoft.Tye --version "0.6.0-alpha.21070.5"

````

```shell
mkdir myweatherapp
cd myweatherapp
dotnet new razor -n frontend
````

## Tye'ing The Services

{{< subscribe >}}
