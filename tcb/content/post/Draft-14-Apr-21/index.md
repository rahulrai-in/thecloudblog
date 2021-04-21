---
title: Distributed Tracing in ASP.NET Core with Jaeger and Tye
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


Modern microservices applications consist of many services deployed on various hosts such as Kubernetes, AWS ECS, and Azure App Services or serverless compute services such as AWS Lambda and Azure Functions. One of the key challenges of microservices is the reduced visibility of requests that span multiple services. In distributed systems that perform various operations such as database queries, publish and consume messages, and trigger jobs, how would you quickly find issues and monitor the behavior of services? The answer to the perplexing problem is Distributed Tracing.

## Distributed Tracing and Open Tracing

Distributed Tracing is the capability of a tracing solution that you can use to track a request across multiple services. The tracing solutions use one or more correlation IDs to collate the request traces and store the traces, which are structured log events across different services, in a central database.

[Open Tracing](https://opentracing.io/) defines an open, vendor-neutral API for distributed tracing. The specification allows the vendors such as Jaeger and Zipkin to implement their unique distributed tracing functionality and enables the users to avoid vendor lock-in from a particular tracer implementation.

[Jaeger](https://www.jaegertracing.io/) is an open-source tracing system for microservices and it supports the Open Tracing standard. It was initally built and open-sourced by [Uber Technologies](https://uber.github.io/) and is now a [CNCF](https://www.cncf.io/) graduated project. Some of the high level use cases of Jaeger are the following:

1. Performance and latency optimization
2. Distributed transaction monitoring
3. Service dependency analysis
4. Distributed context propagation
5. Root cause analysis

Jaeger is composed of [multiple components](https://www.jaegertracing.io/docs/1.22/architecture/): 

1. Client libraries: These are language specific implementations of the Open Tracing API.
2. Agent: The agent is a network daemon that collects spans from the application, batches them and send them to the collector. 
3. Collector: The collector receives traces from the agent and runs them through a processing pipeline which validates the the traces, indexes them, performs any transformations and finally stores them.
4. Query: The query service retrieves traces from storage and renders the UI to display them.


You can run Jaeger on your local environment (and CI/CD environments) using the all-in-one 


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

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
