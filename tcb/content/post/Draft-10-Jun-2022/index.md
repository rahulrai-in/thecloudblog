---
title: Ingesting Application Metrics with OpenTelemetry Collector
date: 2022-06-10
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

An application is said to be observable if it can emit three telemetry signals: **Distributed Traces**, **Metrics**, and **Logs**.

1. A distributed trace is a series of event data generated at various points in the application as the request travels through it. The traces across the services are tied to the same unique identifier, which makes it possible to trace a request across multiple services. You can read more about distributed traces [on the W3C website](https://www.w3.org/TR/trace-context-1/).

2. A metric is a value recorded at a given time. For example, some common metrics you might have encountered are CPU consumption and memory consumption of the server resources by an application at a given time.

3. A log is a record of events written by the application. There are no prescribed formats for writing logs. However, at the minimum, a log should consist of a **timestamp** denoting the time at which the event occurred and a **message** describing the event.

An observable application is easy to monitor and debug when issues occur. In a large-scale microservices deployment consisting of services built with different technology stacks, you need a well-defined standard for applications to report telemetry. If applications can report telemetry in a uniform manner, you can use standard telemetry ingestion services to record the telemetry. [OpenTelemetry or OTEL](https://opentelemetry.io/) is an open-source standard that prescribes the format of the telemetry data. It also includes a set of APIs, SDKs, and tools to help you collect and process the telemetry data.

OpenTelemetry can help your applications generate traces, metrics, and logs, but the data is not usable until it is stored and visualized. There are several powerful backends that can ingest one or all of the telemetry signals, such as [Zipkin](https://zipkin.io/) for traces, [Prometheus](https://prometheus.io/) for metrics, [Elasticsearch](https://www.elastic.co/) for logs, or services such as [Lightstep](https://lightstep.com/) for all of the telemetry signals. However, instrumenting a large number of applications to convert telemetry data to the standard formats of the backends is impractical. It is also not easy to process the telemetry signals (enrich, batch, etc.) before they are sent to the backend. So let's discuss how OpenTelemetry Collector can help you solve this problem.

## OpenTelemetry Collector as the Solution

[OpenTelemetry Collector](https://opentelemetry.io/docs/collector/) is a bridge between your application and the telemetry backend. It is a service that runs in proximity to your application, receives the telemetry data from it, processes the telemetry, and sends it to the backend for storage and visualization.

Note that you might not always need an external collector to export telemetry to a backend. For small applications, it is reasonable to use built-in exporters provided by the OpenTelemetry SDK to ship the telemetry directly to popular backends such as Zipkin. Exporters are small pieces of code that can translate traces and metrics to formats recognized by the backend, and they are already baked in the OpenTelemetry SDKs such as [.NET](https://opentelemetry.io/docs/instrumentation/net/exporters/), and [Golang](https://opentelemetry.io/docs/instrumentation/go/exporting_data/).

A collector is a much more complicated service than an exporter. It is deployed close to the application, enabling your application to offload its telemetry data quickly. The collector then takes care of additional concerns such as retries, batching, encryption, and sensitive data filtering.

## The Components of The OpenTelemetry Collector

The OTEL collector allows the user to set up a separate pipeline for each telemetry signal (metrics, logs, and traces). A pipeline consists of one or more of the following components that are executed in sequence to process the telemetry data:

1. **Receivers**: The receiver component is responsible for receiving the telemetry data from the application. Typically, the receiver registers a listener on a port in the collector and listens for requests in its supported protocol. For example, by default, the Jaeger receiver supports the Thrift Binary protocol on port 6832.
2. **Processors**: The processor enables you to perform custom operations on the telemetry data. For example, you can add custom attributes to the telemetry data using the Attribute processor or exclude sensitive data from the telemetry data using the Filter processor. The processors are executed in the sequence in which they are configured. Hence, you should employ caution during the configuration of the processors.
3. **Exporters**: Exporters in the OTEL collector play the same role as the exporters in the SDKs. They are responsible for converting the telemetry data to the format that the backend expects and sending it to the backend.

{{< img src="5.png" alt="OpenTelemetry collector" >}}

You might be wondering about the format of the telemetry data coming from the application and the data exported by the OTEL collector. OpenTelemetry defines a standard named [OpenTelemetry Protocol (OTLP)](https://opentelemetry.io/docs/reference/specification/protocol/otlp/) which describes how telemetry data should be encoded, transported, and delivered between telemetry sources, collectors, and backends. The [OpenTelemetry website](https://opentelemetry.io/vendors/) lists the vendors that support the OTLP protocol in their products. OTLP is gaining widespread adoption, and traditional backends such as [Jaeger have already retired their custom telemetry format](https://medium.com/jaegertracing/introducing-native-support-for-opentelemetry-in-jaeger-eb661be8183c) in favor of OTLP.

## OpenTelemetry Metrics Pipeline

The OpenTelemetry metrics signal is designed to be processed similarly to the tracing signal. So you will see a lot of resemblance between the process followed by traces and metrics to the reach the backend. The OTEL SDK defines a pipeline of components that every measurement needs to pass through, just like the traces. The metrics pipeline is made up of the following components:

1. **[MeterProvider](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/api.md#meterprovider)**: It determines how metrics should be generated. It is used to create a **meter**.
2. **[Meter](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/api.md#meter)**: It is used to create **instruments**. Each instrument is used to record **measurements**.
3. **[View](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/sdk.md#view)**: It enables application developers to filter and process metrics.
4. **[MetricReader](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/sdk.md#metricreader)**: It collects metrics being recorded.
5. **[MetricExporter](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/metrics/sdk.md#metricexporter)**: It translates metrics into the desired output format.

{{< img src="6.png" alt="OpenTelemetry metrics pipeline" >}}

Applications are responsible for generating measurements. A metric is simply the current aggregated value of the instrument's measurements. A large number of measurements can overwhelm the collector. To combat this issue, OpenTelemetry attaches an aggregating View to each Instrument which keeps aggregating the value of measurements (aggregated measurements are metrics). The MetricReader periodically reads the metric value from the View and uses the MetricExporter to send the metrics to the collector or other downstream service.

## Demo: Azure Voting App

Now that we are familiar with the core components of the OTEL collector and OTLP let's use an OTEL collector to gather metrics from an application and export them to the Lightstep backend, which supports ingesting OTLP formatted telemetry. I will use a simple application for the demo that generates custom metrics on user actions. First, let's discuss the essential components of our demo application: [Azure Voting App](https://github.com/rahulrai-in/azure-voting-app-dotnet). Please visit the repository and familiarize yourself with the organization of the application's source code.

Navigate to the `Program.cs` file. The following code creates a metrics pipeline with all the components discussed in the previous section. Since we want to send the metrics to a local OTEL collector, we will use the [OTLPExporter](https://opentelemetry.io/docs/instrumentation/js/exporters/#otlp-endpoint-or-collector) in the pipeline to export the metrics to an OLTP endpoint. We will later deploy a local OpenTelemetry collector that will listen to OTLP traffic from the application.

```csharp
builder.Services.AddOpenTelemetryMetrics(meterProviderBuilder =>
    {
        meterProviderBuilder.AddAspNetCoreInstrumentation()
            .AddMeter("my-corp.azure-vote.vote-app")
            // Create resources (key-value pairs) that describe your service such as service name and version
            .SetResourceBuilder(
                ResourceBuilder.CreateDefault().AddService("vote-app")
                    .AddAttributes(new[] { new KeyValuePair<string, object>("service.version", "1.0.0.0") }))
            // Displays metrics on the console. Useful for debugging.
            .AddConsoleExporter();
        if (builder.Configuration.GetValue<bool>("EnableOtlpExporter"))
        {
            // Exports metrics to an OTLP endpoint. Use this for exporting metrics to collector or a backend that support OTLP over HTTP
            meterProviderBuilder.AddOtlpExporter(otlpOptions =>
            {
                otlpOptions.Endpoint = new(builder.Configuration.GetConnectionString("OTLPMetricsExporterEndpoint"));
                otlpOptions.Protocol = OtlpExportProtocol.HttpProtobuf;
            });
        }
    }
);
```

We registered a meter named `my-corp.azure-vote.vote-app` in the Meter Provider. The following code creates an instance of the registered meter that we will later use to build instruments to record metrics.

```csharp
builder.Services.AddSingleton(new Meter("my-corp.azure-vote.vote-app"));
```

The application is designed to generate custom metrics to record the count of **Vote** and **Reset** button clicks. Navigate to the `VoteService` class and inspect the constructor code where we create the instruments as follows:

```csharp
public VoteService(IConnectionMultiplexer multiplexer, IOptions<VoteAppSettings> settings, ActivitySource activitySource, Meter meter)
{
    _votesCounter = meter.CreateCounter<long>("vote_count", description: "Counts number of votes cast");
    _resetCounter = meter.CreateCounter<long>("reset_count", description: "Counts number of resets");
}
```

Finally, inspect the `IncrementVoteAsync`, and `ResetVotesAsync` methods that record the measurements using the instruments as follows:

```csharp {hl_lines=[11,15,29]}
public async Task<(Vote vote1, Vote vote2)> IncrementVoteAsync(int? candidate)
{
    using var activity = _activitySource.StartActivity(nameof(IncrementVoteAsync), ActivityKind.Server);
    activity?.AddEvent(new("Vote added"));
    activity?.SetTag(nameof(candidate), candidate);
    var redis = _multiplexer.GetDatabase();
    switch (candidate)
    {
        case 1:
            await redis.StringIncrementAsync(Vote1Key);
            _votesCounter.Add(1, tag: new("candidate", Vote1Key));
            break;
        case 2:
            await redis.StringIncrementAsync(Vote2Key);
            _votesCounter.Add(1, tag: new("candidate", Vote2Key));
            break;
    }

    return await GetVotes(redis);
}

public async Task<(Vote vote1, Vote vote2)> ResetVotesAsync()
{
    using var activity = _activitySource.StartActivity(nameof(ResetVotesAsync), ActivityKind.Server);
    activity?.AddEvent(new("Reset event"));
    var redis = _multiplexer.GetDatabase();
    await redis.StringSetAsync(Vote1Key, 0);
    await redis.StringSetAsync(Vote2Key, 0);
    _resetCounter.Add(1);
    return await GetVotes(redis);
}
```

I have published the [container image of this application on GitHub here](https://github.com/rahulrai-in/azure-voting-app-dotnet/pkgs/container/azure-voting-app-dotnet) to save us the effort of building the application.
As we discussed earlier, this application is instrumented to send metrics and traces to an OTLP endpoint. We will set up a local OpenTelemetry collector and have the application send the OTLP traffic to it. Create the following [Docker Compose](https://docs.docker.com/compose/) file that will instruct Docker Desktop to spin up all the containers required by the application: the frontend application, the Redis database, and the OpenTelemetry collector:

```yaml
version: "3.9"
services:
  azure-vote-back:
    image: redis:latest
    container_name: azure-vote-back
    environment:
      ALLOW_EMPTY_PASSWORD: "yes"
    ports:
      - 6379:6379

  azure-vote-front:
    image: ghcr.io/rahulrai-in/azure-voting-app-dotnet:latest
    container_name: azure-vote-front
    depends_on:
      - azure-vote-back
    environment:
      ConnectionStrings__RedisHost: azure-vote-back
      # Set the following parameter to true if you want to send traces and metrics to the local OTEL collector
      EnableOTLPExporter: true
      ConnectionStrings__OTLPMetricsExporterEndpoint: http://azure-vote-collector:4318/v1/metrics
      ConnectionStrings__OTLPTracesExporterEndpoint: http://azure-vote-collector:4318/v1/traces
    ports:
      - 80:80

  azure-vote-collector:
    image: otel/opentelemetry-collector:latest
    container_name: azure-vote-collector
    ports:
      - 4318:4318
    volumes:
      - ./otel-collector-config.yaml:/otel-collector-config.yaml
    command: ["--config=otel-collector-config.yaml"]
```

Name this file as `docker-compose.yaml` and save it. We now need to configure the OpenTelemetry collector to send the traces to Lightstep. You must have noticed that we have mounted the collector configuration file as a volume to the container. You can [learn more about the schema of the configuration file](https://opentelemetry.io/docs/collector/configuration/) on the OpenTelemetry website.

## Configuring the OpenTelemetry Collector

The steps to connect Lightstep to the OpenTelemetry collector are documented on the [Lightstep website](https://docs.lightstep.com/docs/already-using-collectors). Let's use those instructions to configure our collector.

Create a file named `otel-collector-config.yaml` at the same location as the Docker Compose file and populate it with the following code:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
      http:

processors:

exporters:
  otlp:
    endpoint: ingest.lightstep.com:443
    headers:
      "lightstep-access-token": "<access-token>"

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp]
    metrics:
      receivers: [otlp]
      exporters: [otlp]
```

Create a [Lightstep access token](https://docs.lightstep.com/docs/create-and-manage-access-tokens) using the instructions on the website and populate the `lightstep-access-token` header value with the token.

{{< img src="1.png" alt="Lightstep access token" >}}

Let's start our application and the OTEL collector to start sending metrics to Lightstep backend by executing the following command:

```shell
docker-compose up
```

Once the containers are ready, open the browser and navigate to the application's frontend at [http://localhost](http://localhost). Clicking on the **Vote** and **Reset** buttons will send metrics to the collector and eventually to the Lightstep backend.

{{< img src="2.png" alt="Azure vote app" >}}

## Visualizing Metrics on Lightstep

After generating a few metrics from the application, let's plot them on a graph in Lightstep. [Create a dashboard](https://docs.lightstep.com/docs/create-and-manage-dashboards) on the Lightstep portal and add a new graph to it with the following settings:

{{< img src="3.png" alt="Configuring a graph on Lightstep" >}}

Note that we added the `candidate` attributes to the `vote_count` metric in the application to identify the candidate who received the vote. We can now use the attribute to plot precisely the metrics we want on the graph.

Save the graph and generate more metrics from your application which will be displayed on your dashboard as follows:

{{< img src="4.png" alt="Application and live dashboard" >}}

Lightstep allows you to set up [alerts on the metrics](https://docs.lightstep.com/docs/create-alerts-for-metrics) and view metrics and spans side by side, as shown in the previous screenshot.

## Conclusion

We learned how to use OpenTelemetry to instrument your application and send metrics to a local OpenTelemetry collector. You can configure the metrics and traces pipeline in the OpenTelemetry collector through a configuration file you can supply to the collector as a startup argument. Next, we configured the exporter of the OpenTelemetry collector to send the metrics to Lightstep, which supports receiving telemetry in OTLP format over HTTP. Finally, we learned to create a dashboard on Lightstep with the metrics data we ingested from the application.

{{< subscribe >}}
