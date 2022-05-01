---
title: "OpenTelemetry in Action: Identifying Database Dependencies"
date: 2022-05-01
tags:
  - opentelemetry
  - programming
comment_id: 3a531364-0bf4-413c-a607-ced45209f3ab
---

Microservices can help any organization achieve its goal of increasing agility by addressing critical factors such as improving team autonomy, reducing time to market, cost-effectively scaling for load, and avoiding complete outages of the applications. As organizations break their monolith applications into microservices, one of the major hurdles they encounter is identifying database dependencies.

Database sharing can be a complex and time-consuming challenge to solve. Databases do not allow you to define what is shared and what is not. While modifying a schema to better serve one microservice, you might inadvertently break how another microservice uses that same database.

Additionally, it's often difficult to identify the data owner and locate the business logic that manipulates the data.

In this article, we'll explore how we might use OpenTelemetry to identify the components that share the same database and database objects, such as tables.

## Observability and OpenTelemetry: The Basics

Before we build our demo application, let's lay a foundation by discussing observability and OpenTelemetry.

### What makes an application highly observable?

**A system is said to be highly observable if its internal state can be inferred by studying its output at any point in time**. For example, an observable mobile app that interacts with multiple services can reconstruct a transaction that produces an error response so that developers can identify the root cause of the failure.

{{< img src="1.png" alt="Example of an observable application" >}}

An observable application collects three types of information for every transaction:

1. **Logs**: Record of individual events that make up the transaction.
2. **Metrics**: Record of aggregates of events that make up the transaction.
3. **Traces**: Record of the latency of operations to identify bottlenecks in the transaction.

To reconstruct the system’s state at any point in time, you need all three pieces of information.

## What is OpenTelemetry?

[OpenTelemetry](https://opentelemetry.io/) is a system that generates logs, metrics, and traces in an integrated fashion. OpenTelemetry defines a standard to capture observability data. The OpenTelemetry data model has several key components.

### Attributes

Every data structure in OpenTelemetry is comprised of attributes, which are key-value pairs. The OpenTelemetry standard defines what attributes any component (such as an SQL client or an HTTP request) can specify.

### Events

Events are simply a timestamp and a set of attributes. You can record details such as messages and exception details against an event.

### Context

Context comprises attributes that are common to a set of events. These are two types of contexts. **Static context** (or **resource**) defines the location of events. Their value doesn't change after the application executable starts. Examples include the name or version of the service or the library name.

**Dynamic context** (or **span**) defines the active operation that contains the event. The value of span attributes changes when the operation executes. Some common examples of span attributes include the start time of a request, the HTTP response status code, or the path of the HTTP request.

In a distributed transaction, the context needs to be passed to all the associated services. In such cases the receiver service uses the context to produce new spans. A trace that crosses the service boundary becomes a **distributed trace** and the process of transferring context to other services is called **context propagation**.

### Logs

Logs are events that only accompany resources. One example of this is the event emitted when a program starts up.

### Traces

Events can be organized into a graph of operations associated with resources. A trace is the graph that presents the events related to a transaction.

### Metrics

An event might occur several times in any application, or its value might change. A metric is an event whose value can be the count of related events or some computation of the value of the event. An example of a metric is the system memory event; its attributes are usage and utilization.

To learn about the concepts of OpenTelemetry in detail, refer to the [documentation](https://opentelemetry.lightstep.com/).

## Using OpenTelemetry to Identify Database Dependencies

We discussed earlier that OpenTelemetry prescribes the attributes that the various components of an application should capture. The specification for attributes that should be part of the span covering a database client call is [documented on GitHub](https://github.com/open-telemetry/opentelemetry-specification/blob/main/specification/trace/semantic_conventions/database.md). Many popular languages provide out-of-the-box instrumentation libraries that collect telemetry for database operations.

For this demo, we will use the [.NET SQLClient instrumentation for OpenTelemetry](https://github.com/open-telemetry/opentelemetry-dotnet/tree/main/src/OpenTelemetry.Instrumentation.SqlClient#readme) in coordination with [Lightstep](https://lightstep.com/) for telemetry storage and analysis.

Let's discuss the architecture of the demo application to understand the path that the telemetry takes to reach Lightstep. We'll focus our discussion on traces alone, as they are sufficient to identify the dependency between databases and components of a monolith. However, any enterprise application should generate relevant logs and metrics in addition to traces for complete visibility.

{{< img src="2.png" alt="Exporting OTEL traces from .NET application" >}}

First, we will instrument our monolith application with the OpenTelemetry SDK to emit observability signals. While instrumenting the application is a manual process for .NET applications, automatic instrumentation is available for applications built with languages such as Golang or Java.

We use the OpenTelemetry Protocol (OTLP) Exporter, which is included with the SDK. The exporter lets us send data directly to a telemetry ingestion service. OpenTelemetry platforms such as Jaeger and Lightstep aggregate the traces to help you draw insights.

Once integrated with the SDK, the various parts of your application, such as the ASP.NET Core request handler and SQL Client, automatically start producing traces with relevant information. Your code can generate additional traces to enrich the available information. In the case of .NET, the OpenTelemetry implementation is based on the existing types in the `System.Diagnostics.*` namespace as follows:

1. `System.Diagnostics.ActivitySource` represents an OpenTelemetry tracer responsible for producing `Spans`.

2. `System.Diagnostics.Activity` represents a `Span`.

3. You can add attributes to a span using the `AddTag` function. Also, you can add baggage using the `AddBaggage` function. The baggage is transported to the child activities, which might be available in other services using the W3C header.

After instrumenting your application, you can run automated tests or allow users to use your application to cover all the interaction paths between the application and database.

## Demonstration

Let's create a simple monolithic Employee Management Service (EMS) modeled as an [ASP.NET Core minimal API](https://docs.microsoft.com/en-us/aspnet/core/tutorials/min-web-api?view=aspnetcore-6.0&tabs=visual-studio). Our API will have the following endpoints:

1. `POST /ems/billing`: Records the hours worked by an employee on a project.

2. `GET /ems/billing/{employeeId}`: Fetches an employee's hours on different projects.

3. `POST /ems/payroll/add`: Adds an employee to payroll.

4. `GET /ems/payroll/{employeeId}`: Fetches the payroll data for the employee.

You'll notice that the monolith serves two distinct domains: billing and payroll. Such dependencies might not be very evident in complex monoliths, and segregating them might require significant code refactoring. However, by studying the dependencies, you can uncouple them with little effort.\
The complete source code of the EMS application is available in the following GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/otel-db-samples/tree/main/linked-db" >}}

### Spinning up the database

First, we start a SQL server instance in docker:

```shell
docker run \
-e "ACCEPT_EULA=Y" \
-e "SA_PASSWORD=Str0ngPa$$w0rd" \
-p 1433:1433 \
--name monolith-db \
--hostname sql1 \
-d mcr.microsoft.com/mssql/server:2019-latest
```

We use the following SQL script to create the EMS database and the tables used by our application:

```sql
IF NOT EXISTS(SELECT * FROM sys.databases WHERE name = 'EMSDb')
BEGIN
  CREATE DATABASE EMSDb
END
GO

USE EMSDb

IF OBJECT_ID('[dbo].[Timekeeping]', 'U') IS NULL
BEGIN
  CREATE TABLE [Timekeeping] (
    [EmployeeId]      INT  NOT NULL,
    [ProjectId]       INT  NOT NULL,
    [WeekClosingDate] DATETIME NOT NULL,
    [HoursWorked]     INT  NOT NULL,
    CONSTRAINT [PK_Timekeeping] PRIMARY KEY CLUSTERED ([EmployeeId] ASC, [ProjectId] ASC,  [WeekClosingDate] ASC)
  )
END
GO

IF OBJECT_ID('[dbo].[Payroll]', 'U') IS NULL
BEGIN
  CREATE TABLE [Payroll] (
    [EmployeeId]   INT   NOT NULL,
    [PayRateInUSD] MONEY DEFAULT 0 NOT NULL,
    CONSTRAINT [PK_Payroll] PRIMARY KEY CLUSTERED ([EmployeeId] ASC)
  )
END
GO
```

### Implementing the API service

Next, we write the code for the API endpoints. We replace the boilerplate code in the Program class with the following code:

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddScoped(_ =>
    new SqlConnection(builder.Configuration.GetConnectionString("EmployeeDbConnectionString")));
var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.MapPost("/ems/billing", async (Timekeeping timekeepingRecord, SqlConnection db) =>
    {
        await db.ExecuteAsync(
            "INSERT INTO Timekeeping Values(@EmployeeId, @ProjectId, @WeekClosingDate, @HoursWorked)",
            timekeepingRecord);
        return Results.Created($"/ems/billing/{timekeepingRecord.EmployeeId}", timekeepingRecord);
    })
    .WithName("RecordProjectWork")
    .Produces(StatusCodes.Status201Created);

app.MapGet("/ems/billing/{empId}/", async (int empId, SqlConnection db) =>
    {
        var result = await db.QueryAsync<Timekeeping>("SELECT * FROM Timekeeping WHERE EmployeeId=@empId", empId);
        return result.Any() ? Results.Ok(result) : Results.NotFound();
    })
    .WithName("GetBillingDetails")
    .Produces<IEnumerable<Timekeeping>>()
    .Produces(StatusCodes.Status404NotFound);

app.MapPost("/ems/payroll/add/", async (Payroll payrollRecord, SqlConnection db) =>
    {
        await db.ExecuteAsync(
            "INSERT INTO Payroll Values(@EmployeeId, @PayRateInUSD)", payrollRecord);
        return Results.Created($"/ems/payroll/{payrollRecord.EmployeeId}", payrollRecord);
    })
    .WithName("AddEmployeeToPayroll")
    .Produces(StatusCodes.Status201Created);

app.MapGet("/ems/payroll/{empId}", async (int empId, SqlConnection db) =>
    {
        var result = await db.QueryAsync<Payroll>("SELECT * FROM Payroll WHERE EmployeeId=@empId", empId);
        return result.Any() ? Results.Ok(result) : Results.NotFound();
    })
    .WithName("GetEmployeePayroll")
    .Produces<IEnumerable<Payroll>>()
    .Produces(StatusCodes.Status404NotFound);

app.Run();


public class Timekeeping
{
    public int EmployeeId { get; set; }
    public int ProjectId { get; set; }
    public DateTime WeekClosingDate { get; set; }
    public int HoursWorked { get; set; }
}

public class Payroll
{
    public int EmployeeId { get; set; }
    public decimal PayRateInUSD { get; set; }
}
```

At this point, we can run the application, test the various endpoints, and look at the records saved in the database. Although the database dependencies of the various endpoints and request paths are clearly evident in this demonstration case, this would not be the case in large applications.

Next, let’s automate the process of discovering database dependencies.

### Adding instrumentation

We instrument the application with the [OpenTelemetry SDK](https://github.com/open-telemetry/opentelemetry-dotnet/tree/main/src/OpenTelemetry.Instrumentation.SqlClient) and [SqlClient instrumentation library for .NET](https://github.com/open-telemetry/opentelemetry-dotnet/tree/main/src/OpenTelemetry.Instrumentation.SqlClient). First, we add the following NuGet package references to the API's project file:

```xml
<PackageReference Include="OpenTelemetry" Version="1.2.0-rc2" />
<PackageReference Include="OpenTelemetry.Exporter.OpenTelemetryProtocol" Version="1.2.0-rc2" />
<PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.0.0-rc9" />
<PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.0.0-rc9" />
<PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.0.0-rc9" />
<PackageReference Include="OpenTelemetry.Instrumentation.SqlClient" Version="1.0.0-rc9" />
```

The SDK provides us with several extension methods that we can use to quickly plug OpenTelemetry into the request processing pipeline.

The following piece of code instruments OpenTelemetry in our API. It will also instrument the `SqlClient` to emit verbose telemetry. The telemetry from the `SqlClient` is key to identifying the database dependencies in detail.

```csharp
// Configure tracing
builder.Services.AddOpenTelemetryTracing(builder => builder
    // Customize the traces gathered by the HTTP request handler
    .AddAspNetCoreInstrumentation(options =>
    {
        // Only capture the spans generated from the ems/* endpoints
        options.Filter = context => context.Request.Path.Value?.Contains("ems") ?? false;
        options.RecordException = true;
        // Add metadata for the request such as the HTTP method and response length
        options.Enrich = (activity, eventName, rawObject) =>
        {
            switch (eventName)
            {
                case "OnStartActivity":
                {
                    if (rawObject is not HttpRequest httpRequest)
                    {
                        return;
                    }

                    activity.SetTag("requestProtocol", httpRequest.Protocol);
                    activity.SetTag("requestMethod", httpRequest.Method);
                    break;
                }
                case "OnStopActivity":
                {
                    if (rawObject is HttpResponse httpResponse)
                    {
                        activity.SetTag("responseLength", httpResponse.ContentLength);
                    }

                    break;
                }
            }
        };
    })
    // Customize the telemetry generated by the SqlClient
    .AddSqlClientInstrumentation(options =>
    {
        options.EnableConnectionLevelAttributes = true;
        options.SetDbStatementForStoredProcedure = true;
        options.SetDbStatementForText = true;
        options.RecordException = true;
        options.Enrich = (activity, x, y) => activity.SetTag("db.type", "sql");
    })
    .AddSource("my-corp.ems.ems-api")
    // Create resources (key-value pairs) that describe your service such as service name and version
    .SetResourceBuilder(ResourceBuilder.CreateDefault().AddService("ems-api")
        .AddAttributes(new[] { new KeyValuePair<string, object>("service.version", "1.0.0.0") }))
    // Ensures that all activities are recorded and sent to exporter
    .SetSampler(new AlwaysOnSampler())
    // Exports spans to Lightstep
    .AddOtlpExporter(otlpOptions =>
    {
        otlpOptions.Endpoint = new Uri("https://ingest.lightstep.com:443/traces/otlp/v0.9");
        otlpOptions.Headers = $"lightstep-access-token={lsToken}";
        otlpOptions.Protocol = OtlpExportProtocol.HttpProtobuf;
    }));
```

Although the instrumentation is sufficient for us in its current state, let’s enrich the data further by adding relevant traces.

First, we define a tracer from which our application spans will originate.

```csharp
var activitySource = new ActivitySource("my-corp.ems.ems-api");
```

Next, we create a span and add relevant details—attributes and events:

```csharp
app.MapPost("/ems/billing", async (Timekeeping timekeepingRecord, SqlConnection db) =>
    {
        using var activity = activitySource.StartActivity("Record project work", ActivityKind.Server);
        activity?.AddEvent(new ActivityEvent("Project billed"));
        activity?.SetTag(nameof(Timekeeping.EmployeeId), timekeepingRecord.EmployeeId);
        activity?.SetTag(nameof(Timekeeping.ProjectId), timekeepingRecord.ProjectId);
        activity?.SetTag(nameof(Timekeeping.WeekClosingDate), timekeepingRecord.WeekClosingDate);

        await db.ExecuteAsync(
            "INSERT INTO Timekeeping Values(@EmployeeId, @ProjectId, @WeekClosingDate, @HoursWorked)",
            timekeepingRecord);
        return Results.Created($"/ems/billing/{timekeepingRecord.EmployeeId}", timekeepingRecord);
    })
    .WithName("RecordProjectWork")
    .Produces(StatusCodes.Status201Created);
```

We follow the same procedure to instrument the remaining endpoints.

### Connecting to Lightstep

Finally, we need an API key to send traces to Lightstep. We start by [creating an account](https://app.lightstep.com/signup/developer?signup_source=nav). From the Project settings page of our account, we find the Token, which will serve as our API key.

{{< img src="3.png" alt="Your API key in Lightstep" >}}

We copy the token and paste it in the `appsettings` file.

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "EmployeeDbConnectionString": "Server=localhost;Database=EMSDb;User Id=sa;Password=Str0ngPa$$w0rd;"
  },
  "LsToken": "<Lightstep token>"
}
```

### Sending requests

Our application is now ready. We launch the application and send some requests to each endpoint. Here is an example of a request that I sent to the `/ems/billing` endpoint. This request should create a record in the **Timekeeping** table of the database.

{{< img src="4.png" alt="Sending request to the billing endpoint" >}}

Here’s another request I made to the `/emp/payroll/add` endpoint to add a record to the Payroll table:

{{< img src="5.png" alt="Sending request to the payroll endpoint" >}}

When we navigate to the [Lightstep observability portal](https://app.lightstep.com/), we can click on the Operations tab to see all the spans Lightstep received from the application.

{{< img src="6.png" alt="View spans from the application in Lightstep" >}}

When we click on the `/ems/payroll/add` operation, we can view the end-to-end trace. By viewing the spans, we can ascertain the sequence of operations for any request. Clicking on the spans brings up its events and attributes, from which we can gain deeper insights into the operation. The final span visible in the trace is **EMSDb**, which was generated by our instrumented SQL Client. We click on the span to view its attributes and events as follows:

{{< img src="7.png" alt="Details of the span generated by the payroll endpoint" >}}

We can draw some key insights from the attributes:

1. The name of the database
2. The SQL statement used in the database operation
3. The type of SQL statement (text or stored procedure)
4. The hostname of the service that made the request

We find a similar set of details from the child span of the `/ems/billing` operation.

{{< img src="8.png" alt="Details of the span generated by the billing endpoint" >}}

By combing the information from the traces, we can infer the following:

1. Ingress operations (operations that receive the external request)
2. The sequence of activities to fulfill a request, including external service calls and database operations.
3. Database operations involved in each operation.

Together, this information is sufficient for us to plan the segregation of services and databases and establish contacts for communication between the microservices.

## Conclusion

This article discussed one of the common challenges that developers encounter while transitioning their monolith applications to microservices. Of all the concerns, splitting a database is a complex endeavor because any service that has access to the database can manipulate it.

By using OpenTelemetry, we can identify the dependencies among the various components and between the components and the database. With the knowledge and understanding of our dependencies, we can develop the refactoring plan for our components, planning how they should evolve as independent microservices.

{{< subscribe >}}
