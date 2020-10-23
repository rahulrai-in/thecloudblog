---
title: Monitoring Health of ASP.NET Core Background Services with TCP Probes on Kubernetes
date: 2020-10-18
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Many microservices applications require background tasks and scheduled jobs to process requests asynchronously. In the .NET Core ecosystem, background services are called _Hosted services_ because a single host such as a web host or a console host can run several such services in the background while it is alive. In terms of implementation, a hosted service is required to implement the [`IHostedService`](https://docs.microsoft.com/en-us/dotnet/api/microsoft.extensions.hosting.ihostedservice) interface. You can implement the `IHostedService` interface yourself, or even better, leverage the `BackgroundService` class that implements some of the common concerns such as cancellation token management and error propagation to the host for you. A class inheriting from the `BackgroundService` abstract class only needs to implement the `ExecuteAsync` method to define the background task's business logic. If you want to read more about the internals of ASP.NET Core background tasks, please refer to the [Microsoft documentation](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services).

Kubernetes relies on probes in your application to assess whether your application is healthy. If you are not familiar with the types of health probes used by Kubernetes, you can read more about them on the [Kubernetes documentation](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/). If your application continuously fails to respond or responds with an error to several probe requests, Kubernetes restarts the pod.

In ASP.NET Core, you can use the implicitly referenced package `Microsoft.AspNetCore.Diagnostics.HealthChecks` to add health checks to your application. The core health check package does not support probing external services such as a database. If your application's health depends on external services, you can add custom probes by implementing the `IHealthCheck` interface. We will shortly see how simple it is to implement one. Refer to the official [Microsoft guidance on health checks](https://docs.microsoft.com/en-us/aspnet/core/host-and-deploy/health-checks) for ASP.NET Core applications that describes this concept in detail.

The default implementation of health checks on ASP.NET Core consists of a middleware, a hosted service, and a few libraries. The health check probes are exposed by your application over HTTP. Since there is a lot of goodness packaged in the ASP.NET Core health check framework, we will leverage it to expose health probes over TCP. But why would you want to consider the modified TCP based implementation of health probes over the default HTTP based one? You might not want to include the whole shebang of routing and middleware in your background services on which the ASP.NET Core health checks are dependent. In such cases, exposing a single port attached to a TCP listener is a suitable choice.

## The Nine to Five Application

There are days at the office when you are just counting minutes until the clock strikes five. For pushing through such days, I built a simple background service that displays the number of minutes left in the workday from Monday to Friday between 9 A.M and 5 P.M. The source code of the application is available on my Github repository.

{{< sourceCode src="https://github.com/rahulrai-in/worker-service-kubernetes" >}}

We will configure health checks on this service and deploy it to our local Kubernetes cluster. I recommend using either [Docker Desktop](https://www.docker.com/products/docker-desktop) or [KinD](https://kind.sigs.k8s.io/) for running a local Kubernetes cluster. Let's discuss the details of the implementation of this service next.

## The Service

The following code listing presents the hosted service/background service that logs the time left in the workday every minute. It also logs a message every minute for weekends and before and after work hours.

```cs
public class Worker : BackgroundService
{
    private readonly ILogger<Worker> _logger;

    public Worker(ILogger<Worker> logger)
    {
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var fiveOClock = new TimeSpan(17, 0, 0);
        var nineOClock = new TimeSpan(9, 0, 0);
        var timeZone = DateTimeZoneProviders.Tzdb["Australia/Sydney"];
        while (!stoppingToken.IsCancellationRequested)
        {
            var now = Instant.FromDateTimeUtc(DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc));
            var nowLocal = now.InZone(timeZone).ToDateTimeUnspecified();
            if (nowLocal.DayOfWeek == DayOfWeek.Saturday || nowLocal.DayOfWeek == DayOfWeek.Sunday)
            {
                _logger.LogInformation("{Time}: Cheers to the weekend!", nowLocal);
            }
            else
            {
                var message = nowLocal switch
                {
                    _ when nowLocal.Hour >= 9 && nowLocal.Hour <= 16 =>
                    $"Hang in there, just {fiveOClock.Subtract(nowLocal.TimeOfDay).TotalMinutes} minutes to go!",

                    _ when nowLocal.Hour < 9 =>
                    $"Get ready, office hours start in {nineOClock.Subtract(nowLocal.TimeOfDay).TotalMinutes} minutes!",

                    _ => "You are done for the day, relax!"
                };

                _logger.LogInformation("{Time}: " + message, nowLocal);
            }

            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

To execute this service, you need to register this service with the host using the `AddHostedService` method.

```cs
public static IHostBuilder CreateHostBuilder(string[] args)
{
    return Host.CreateDefaultBuilder(args)
        .ConfigureServices((hostContext, services) =>
        {
            // Register services that do actual work here.
            services.AddHostedService<Worker>();
        });
}
```

Let's now add health checks to our service and deploy it to Kubernetes.

## Health Check Service

You can add custom health checks to your application by implementing the `IHealthCheck` interface, which requires defining the `CheckHealthAsync` method. The following health check implementation returns a random response to indicate service health as either Healthy or Unhealthy.

```cs
public class CustomHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = new CancellationToken())
    {
        // Randomly sets to true or false
        var flipFlop = new Random().Next(2) == 1;
        return Task.FromResult(flipFlop
            ? new HealthCheckResult(HealthStatus.Healthy)
            : new HealthCheckResult(HealthStatus.Unhealthy, "Random error",
                data: new Dictionary<string, object> {{nameof(flipFlop), false}}));
    }
}
```

To register the custom health check, you need to add the service type and the name of the check to the health check services using the `AddCheck` method as follows.

```cs
return Host.CreateDefaultBuilder(args)
    .ConfigureServices((hostContext, services) =>
    {
        // Health check services. A custom health check service is added for demo.
        services.AddHealthChecks().AddCheck<CustomHealthCheck>("custom_hc");
    });
```

We need to attach a TCP listener to the health check port that will report the service's health when Kubernetes executes a liveness or readiness probe. Following is the implementation of the `TcpHealthProbeService` which is a hosted service that does that.

```cs
public sealed class TcpHealthProbeService : BackgroundService
{
    private readonly HealthCheckService _healthCheckService;
    private readonly TcpListener _listener;
    private readonly ILogger<TcpHealthProbeService> _logger;

    public TcpHealthProbeService(
        HealthCheckService healthCheckService,
        ILogger<TcpHealthProbeService> logger,
        IConfiguration config)
    {
        _healthCheckService = healthCheckService ?? throw new ArgumentNullException(nameof(healthCheckService));
        _logger = logger;

        // Attach TCP listener to the port in configuration
        var port = config.GetValue<int?>("HealthProbe:TcpPort") ?? 5000;
        _listener = new TcpListener(IPAddress.Any, port);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Started health check service.");
        await Task.Yield();
        _listener.Start();
        while (!stoppingToken.IsCancellationRequested)
        {
            // Respond to the pending TCP calls every second.
            await UpdateHeartbeatAsync(stoppingToken);
            Thread.Sleep(TimeSpan.FromSeconds(1));
        }
    }

    private async Task UpdateHeartbeatAsync(CancellationToken token)
    {
        try
        {
            // Get health check results
            var result = await _healthCheckService.CheckHealthAsync(token);
            var isHealthy = result.Status == HealthStatus.Healthy;
            _logger.LogInformation($"Health check status: {isHealthy}");

            if (isHealthy && !_listener.Server.IsBound)
            {
                _logger.LogWarning("Application healthy - starting TCP listener.");
                _listener.Start();
            }

            if (!isHealthy && _listener.Server.IsBound)
            {
                _logger.LogWarning("Application unhealthy - stopping TCP listener.");
                _listener.Stop();
            }

            while (_listener.Server.IsBound && _listener.Pending())
            {
                var client = await _listener.AcceptTcpClientAsync();
                var stream = client.GetStream();
                var writer = new StreamWriter(stream);
                await writer.WriteLineAsync("OK");
                await stream.FlushAsync(token);
                client.Close();
                _logger.LogInformation("Processed health check request.");
            }

            _logger.LogDebug("Heartbeat check executed.");
        }
        catch (Exception ex)
        {
            _logger.LogCritical(ex, "An error occurred while checking heartbeat.");
        }
    }
}
```

Inside the `UpdateHeartbeatAsync` method, which is invoked every second, we call the `CheckHealthAsync` method of the `HealthCheckService` class that requests all the registered health check services to report the health of the service. Based on the response that we receive, we either respond to the probe or halt the TCP listener and thereby do not report the service's health. Kubernetes treats unresponded requests as a permanent error after reaching the consecutive failure threshold.

## Deploy to Kubernetes

Use the following command to build the container image using the Dockerfile in the `OfficeCountdownClock` project.

```sh
docker build . -t nine-to-five:1.0.0
```

Use the following Kubernetes specification to deploy the background service as a pod. In the sample, you will find this specification in the file named _deploy.yml_.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demo-ns
---
apiVersion: v1
kind: Pod
metadata:
  name: worker
  namespace: demo-ns
  labels:
    app: nine-to-five
spec:
  containers:
    - name: nine-to-five
      image: nine-to-five:1.0.0
      ports:
        - name: health-check
          containerPort: 5000
          hostPort: 5000
      readinessProbe:
        tcpSocket:
          port: health-check
        initialDelaySeconds: 5
        periodSeconds: 10
      livenessProbe:
        tcpSocket:
          port: health-check
        initialDelaySeconds: 15
        periodSeconds: 20
```

To apply the manifest, execute the following command.

```sh
kubectl apply -f deploy.yaml
```

Following is a screenshot of the background service in action. I use the [K9S CLI](https://k9scli.io/) for viewing the cluster statistics.

{{< img src="1.png" alt="Background service logs" >}}

If you check the logs closely, you will also find the logs generated by our TCP listener to respond to the health probes.

{{< img src="2.png" alt="Background service TCP probe logs" >}}

## Conclusion

In this post, we saw how we could add custom health checks to ASP.NET Core applications. We customized the default ASP.NET Core health checks to respond to probes over TCP.

Finally, we configured the liveness and readiness probe settings for our application and deployed it to a local Kubernetes cluster.

{{< subscribe >}}
