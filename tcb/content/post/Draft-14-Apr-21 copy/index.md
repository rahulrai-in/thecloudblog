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

You can run Jaeger on your local environment (and CI/CD environments) using the Jaeger [all-in-one container image](https://hub.docker.com/r/jaegertracing/all-in-one) that runs all the components of Jaeger in one container. In production environment, you should run each component independently. The [deployment guide on the Jaeger website](https://www.jaegertracing.io/docs/1.22/deployment/) covers guidance and recommendations on the deployment. Jaeger recommends

## Jaeger All-in-One

Execute the following command to spin up a Jaeger container backed by an in-memory storage component called **Badger**.

```shell
docker run -d \
  -p 6831:6831/udp \
  -p 6832:6832/udp \
  -p 14268:14268 \
  -p 14250:14250 \
  -p 16686:16686 \
  -p 5778:5778  \
  --name jaeger jaegertracing/all-in-one:1.22
```

Once the container is running, you can inspect the Jaeger dashboard by navigating to [http://localhost:16686/](http://localhost:16686/).

## Source Code

You can download the source code of the demo application from my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

## Demo Application: DCalculator

To mimic a microservices application, we will create two ASP.NET Core Web APIs such that a request traverses the APIs, thus producing distributed traces.

DCalculator is a distributed calculator application composed of several microservices, each of which performs a unique mathematical operation. To keep the demo concise, we will create a microservice named **Calculator** that accepts the parameters required for computing the log of a number for a given log base. We will also create another service named **LogService** that receives the request to calculate log value from the **Calculator** service and uses the following formula to calculate the log of a number- N for a given base- x.

```plaintext
Logₓ(N) = Logₐ(N)/Logₐ(x)
```

Launch your terminal and create a WebAPI project named **Calculator** with the following command.

```shell
dotnet new webapi -n Calculator -o calculator
```

In your terminal change to the **calculator** directory and install the following packages:

```shell
dotnet add package Jaeger
dotnet add package OpenTracing.Contrib.NetCore
```

Edit the `ConfigureServices` method in the `Startup` class which will log traces to our default localhost installation of Jaeger. For details on the usage of the library, please refer to the documentation of the [Jaeger C# Client library](https://github.com/jaegertracing/jaeger-client-csharp/tree/master).

We registered the Open Tracing interface `ITracer` in our dependency injection that resolves to an instance of the Jaeger Tracer. We will later use the `ITracer` to create spans. A span is a unit of work or time in your application. A span can be nested inside another span and it can contain tags and logs.

```csharp
public void ConfigureServices(IServiceCollection services)
{
    ...
    services.AddOpenTracing();
    // Adds the Jaeger Tracer.
    services.AddSingleton<ITracer>(sp =>
    {
        var serviceName = sp.GetRequiredService<IWebHostEnvironment>().ApplicationName;
        var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
        var reporter = new RemoteReporter.Builder().WithLoggerFactory(loggerFactory).WithSender(new UdpSender())
            .Build();
        var tracer = new Tracer.Builder(serviceName)
            // The constant sampler reports every span.
            .WithSampler(new ConstSampler(true))
            // LoggingReporter prints every reported span to the logging framework.
            .WithReporter(reporter)
            .Build();
        return tracer;
    });

    services.Configure<HttpHandlerDiagnosticOptions>(options =>
        options.OperationNameResolver =
            request => $"{request.Method.Method}: {request?.RequestUri?.AbsoluteUri}");
}
```

You can use the [options pattern](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/configuration/options) in ASP.NET Core to configure `HttpHandlerDiagnosticOptions` which is used to customize the span properties. We configured it to customize the operation name to display the HTTP verb and the Absolute URL of the request. You can use it to customize other features such as ignoring certain requests, add tags to spans, and modify the spans that are created when an error occurs.

An Open Telemetry **Trace** is a Directed Acyclic Graph (DAG) of **Spans**. A vertex connecting two spans is called a **Reference**.

Let's add a controller named `CalculatorController` to our application and set it up it to send a request the Log service. We wil also add a custom Span to our controller to record our operation as follows:

```csharp
public class CalculatorController : ControllerBase
{
    private readonly IHttpClientFactory _clientFactory;
    private readonly ITracer _tracer;

    public CalculatorController(IHttpClientFactory clientFactory, ITracer tracer)
    {
        _clientFactory = clientFactory;
        _tracer = tracer;
    }

    [HttpGet("log")]
    public async Task<ActionResult> ComputeLog(int n, int x)
    {
        var actionName = ControllerContext.ActionDescriptor.DisplayName;
        using var scope = _tracer.BuildSpan(actionName).StartActive(true);
        var client = _clientFactory.CreateClient("logService");
        var response = await client.GetAsync($"/log/compute?n={n}&x={x}");
        return response.IsSuccessStatusCode
            ? Ok(Convert.ToDouble(await response.Content.ReadAsStringAsync()))
            : Problem("Log service failed");
    }
}
```

Create the Log service WebAPI application and edit the `Startup` class to add the Open Tracing instrumentation and set up the Jaeger tracer just as you did previously.

To demonstrate how you can record logs with the spans, let's create a controller named `LogController` and add an endpoint named `Compute` to it. This method will compute the log of the number for the given base and return the result in the response. We will record this operation in a custom span and also add a log to the span as follows:

```csharp
public class LogController : ControllerBase
{
    private readonly ITracer _tracer;

    public LogController(ITracer tracer)
    {
        _tracer = tracer;
    }

    [HttpGet("compute")]
    public ActionResult<double> Compute(int n, int x)
    {
        var actionName = ControllerContext.ActionDescriptor.DisplayName;
        using var scope = _tracer.BuildSpan(actionName).StartActive(true);
        scope.Span.Log($"Requested log compute of #{n}, base {x}");
        return Ok(Math.Log(n) / Math.Log(x));
    }
}
```

Let's launch both the services and invoke the Calculator service's **Log** endpoint a few times to generate a few traces.

{{< img src="1.png" alt="Send requests to the Log endpoint" >}}

Navigate to the Jaeger UI at [http://localhost:16686](http://localhost:16686) to view the traces. In the **Find Traces** panel, click on the dropdown, select the **Calculator** service from the list, and click on the **Find Traces** button.

{{< img src="2.png" alt="Traces from the Calculator service" >}}

The Trace view presents some useful information about the request such as:

1. The duration of the request.
2. The name of services and the spans recorded by the services in the trace.
3. The time of the request.

Click on the trace to view the spans present in it.

{{< img src="3.png" alt="Inspect a trace" >}}

In the expanded trace view, you can inspect each span in detail. You can use this view to identify the latency added by the dependencies to process a request and optimize your application. You can also view the details of a span by clicking on it. Let's view the log statement that the the **Log** service added to the span.

{{< img src="4.png" alt="Log in span" >}}

You can view the service dependencies in the **Dependencies** tab. For example, the following view shows that the Calculator service is dependent on the Log service:

{{< img src="5.png" alt="Service DAG" >}}

## Summary

In this short article, we discussed the benefits of distributed tracing. We learnt to set up Jaeger on local environment and the discussed the process to integrate it with an ASP.NET Core application.

In the next article in this series, we will use this application to learn Microsoft's

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
