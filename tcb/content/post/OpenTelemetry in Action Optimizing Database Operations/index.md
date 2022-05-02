---
title: "OpenTelemetry in Action: Optimizing Database Operations"
date: 2022-05-02
tags:
  - opentelemetry
  - programming
comment_id: 1b9fc210-bab5-4373-8726-02ec77e45464
---

Many software developers can attest that some of the most significant issues in their applications arise from database performance. Though many developers prefer to use a relational database for enterprise applications, typical logging and monitoring solutions provide limited signals to detect database performance issues. Rooting out common bad practices such as chatty interactions between the application code and the database is non-trivial.

As developers, we need to understand how our database is performing from the context of user transactions. Ideally, we would have a common tool that can monitor the performance of both the application and the database concerning user transactions. [OpenTelemetry](https://opentelemetry.io/) has emerged as a popular tool for application monitoring, but it can also be extended for monitoring databases.

In this article, we'll look at some common database performance issues to see how we can use OpenTelemetry to identify and fix them easily. For a hands-on learning experience, we'll build a simple application that uses a SQL Server database. We'll instrument the application with standard OpenTelemetry libraries and connect the application to an ingestion platform, [Lightstep](https://lightstep.com/). Finally, we'll use the ingested telemetry to surface our database issues, discussing the steps to resolve them.

## The Basics of Observability and OpenTelemetry

If you're unfamiliar with observability or OpenTelemetry, I recommend familiarizing yourself with the [previous post in this "OpenTelemetry in Action" series](/post/opentelemetry-in-action-identifying-database-dependencies/). In that post, we cover the three types of information collected in an observable application (logs, metrics, and traces). We also look at the key components of the OpenTelemetry data model.

You can refer to this [documentation](https://opentelemetry.lightstep.com/) for more in-depth coverage of how OpenTelemetry works.

### Using OpenTelemetry to monitor databases

We noted how OpenTelemetry is used for instrumenting applications for observability and how it can be extended for us in monitoring databases. This monitoring is done through database clients rather than directly on the database server.

Due to access limitations or the nature of your platform, you may be restricted from installing monitoring libraries on a database server. Instead, you can use the OpenTelemetry instrumentation to monitor the database from the client-side. Though the instrumentation will not give you insights into the internals of the database, it will provide you with sufficient information to troubleshoot performance issues to improve the application user experience.

### Using OpenTelemetry to Detect Database Performance Issues

Our project setup for detecting database performance issues is very similar to [our setup in Part One](/post/opentelemetry-in-action-identifying-database-dependencies/), in which we used OpenTelemetry to identify database dependencies.

Again, we'll use the [.NET SQLClient instrumentation for OpenTelemetry](https://github.com/open-telemetry/opentelemetry-dotnet/tree/main/src/OpenTelemetry.Instrumentation.SqlClient#readme) and [Lightstep](https://lightstep.com/) for telemetry storage and analysis.

{{< img src="1.png" alt="Exporting OTEL traces from .NET application" >}}

We’ll instrument our application with the OpenTelemetry SDK to emit observability signals. We’ll use the OpenTelemetry Protocol (OTLP) Exporter to send data to Lightstep, aggregating our traces and providing us with dashboards to analyze for insights.

## Demonstration

For our demonstration, we'll create a simple Employee Management Service (EMS) modeled as an [ASP.NET Core minimal API](https://docs.microsoft.com/en-us/aspnet/core/tutorials/min-web-api?view=aspnetcore-6.0&tabs=visual-studio). Our API has the following endpoints:

1. `POST /ems/pay/{employeeId}`: Calculates the pay of an employee based on the hours they logged on various projects. This endpoint will exhibit a chatty interaction with the database.

2. `POST /ems/billing/pay-raise`: Updates the pay of every employee earning under USD $300 to USD $300. This endpoint will exhibit querying a non-indexed field in the database.

3. `POST /ems/payroll/remove/{employeeId}`: Removes an employee from payroll. This endpoint will show how database locks affect the performance of queries.

4. `POST /ems/add-employee/{employeeId}`: Adds an employee to the payroll and timekeeping systems. This simulates how the performance of a business transaction spanning multiple services---and so, multiple database calls---can affect system performance.

The application is straightforward, but we've kept it concise to focus on instrumentation and the use of OpenTelemetry. For that reason, you won't see coding best practices such as exception handling.

The application database consists of two tables: Payroll and Timekeeping, which save the employee pay rate and hours worked on a project.

The complete source code of this EMS application is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/otel-db-samples/tree/main/db-optimizations" >}}

### Spinning up the database

We start by spinning up a SQL server instance in docker:

```shell
docker run \
-e "ACCEPT_EULA=Y" \
-e "SA_PASSWORD=Str0ngPa$$w0rd" \
-p 1433:1433 \
--name monolith-db \
--hostname sql1 \
-d mcr.microsoft.com/mssql/server:2019-latest
```

Then, we create the EMS database and the tables used by our application, along with storing some seed data:

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

TRUNCATE TABLE Payroll
TRUNCATE TABLE Timekeeping


INSERT INTO Payroll Values(1, 100)
INSERT INTO Payroll Values(2, 200)
INSERT INTO Payroll Values(3, 300)

INSERT INTO Timekeeping Values(1, 1111, GETDATE(), 10)
INSERT INTO Timekeeping Values(1, 2222, GETDATE(), 15)
INSERT INTO Timekeeping Values(2, 1111, GETDATE(), 15)
INSERT INTO Timekeeping Values(3, 2222, GETDATE(), 20)
GO
```

### Implementing the API endpoints

Then, we write the code for the API endpoints. We replace the boilerplate code in the Program class with the following:

```csharp
using System.Data.SqlClient;
using System.Diagnostics;
using Dapper;
using OpenTelemetry.Exporter;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

var lsToken = builder.Configuration.GetValue<string>("LsToken");

builder.Services.AddScoped(_ =>
    new SqlConnection(
      builder.Configuration.GetConnectionString("EmployeeDbConnectionString")
    )
);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/ems/pay/{empId}", async (int empId, SqlConnection db) =>
    {
        // op 1
        var payroll =
            await db.QuerySingleOrDefaultAsync<Payroll>("SELECT EmployeeId,PayRateInUSD FROM Payroll WHERE EmployeeId=@EmpId",
                new { EmpId = empId });

        // op 2
        var projects = await db.QueryAsync<Timekeeping>("SELECT EmployeeId,ProjectId,WeekClosingDate,HoursWorked FROM Timekeeping WHERE EmployeeId=@EmpId",
            new { EmpId = empId });

        var moneyEarned = projects.Sum(p => p.HoursWorked) * payroll.PayRateInUSD;
        return Results.Ok(moneyEarned);
    })
    .WithName("GetPayment")
    .Produces(StatusCodes.Status200OK);

app.MapPost("/ems/billing/pay-raise/", async (SqlConnection db) =>
    {
        var recordsAffected = await db.ExecuteAsync("UPDATE Payroll SET PayRateInUSD = 300 WHERE PayRateInUSD < 300");
        return Results.Ok(recordsAffected);
    })
    .WithName("Pay-Raise")
    .Produces(StatusCodes.Status200OK);

app.MapPost("/ems/payroll/remove/{empId}", async (int empId, SqlConnection db) =>
    {
        Payroll payrollRecord = new();
        async Task DeleteRecord()
        {
            db.Open();
            await using var tr = await db.BeginTransactionAsync();
            await db.ExecuteAsync("DELETE FROM Payroll WHERE EmployeeId=@EmpId", new { EmpId = empId }, tr);
            Thread.Sleep(5000);
            await tr.CommitAsync();
        }

        async Task GetRecord()
        {
            await using var db1 =
                new SqlConnection(builder.Configuration.GetConnectionString("EmployeeDbConnectionString"));
            Thread.Sleep(100);
            db1.Open();
            payrollRecord =
                await db1.QuerySingleOrDefaultAsync<Payroll>(
                    "SELECT EmployeeId,PayRateInUSD FROM Payroll WHERE EmployeeId=@EmpId", new { EmpId = empId });
            await db1.CloseAsync();
        }

        await Task.WhenAll(DeleteRecord(), GetRecord());

        return Results.Ok(payrollRecord);
    })
    .WithName("RemoveEmployeeFromPayroll")
    .Produces(StatusCodes.Status200OK);

app.MapPost("/ems/add-employee/{empId}", async (int empId, SqlConnection db) =>
    {
        //op 1
        await db.ExecuteAsync("INSERT INTO Payroll Values(@EmployeeId, @PayRateInUSD)",
            new Payroll { EmployeeId = empId, PayRateInUSD = 100 });

        // Simulate service call
        // Mock network call delay
        Thread.Sleep(1000);

        //op 2
        await db.ExecuteAsync(
            "INSERT INTO Timekeeping Values(@EmployeeId, @ProjectId, @WeekClosingDate, @HoursWorked)",
            new Timekeeping
            { EmployeeId = empId, HoursWorked = 0, ProjectId = 1, WeekClosingDate = DateTime.Today });

        return Results.Ok();    })
    .WithName("AddEmployee")
    .Produces(StatusCodes.Status201Created);

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

Now that our application code is in place, let's automate the process of detecting the performance issues we have caused.

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

Next, we instrument OpenTelemetry in our application. This will also instrument the `SqlClient` to emit verbose telemetry. That telemetry will be key to surfacing database performance issues.

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
app.MapGet("/ems/pay/{empId}", async (int empId, SqlConnection db) =>
    {
        using var activity = activitySource.StartActivity("Chatty db operation", ActivityKind.Server);
        activity?.SetTag(nameof(Timekeeping.EmployeeId), empId);

        // op 1
        var payroll =
            await db.QuerySingleOrDefaultAsync<Payroll>("SELECT EmployeeId,PayRateInUSD FROM Payroll WHERE EmployeeId=@EmpId",
                new { EmpId = empId });

        // op 2
        var projects = await db.QueryAsync<Timekeeping>("SELECT EmployeeId,ProjectId,WeekClosingDate,HoursWorked FROM Timekeeping WHERE EmployeeId=@EmpId",
            new { EmpId = empId });

        var moneyEarned = projects.Sum(p => p.HoursWorked) * payroll.PayRateInUSD;
        return Results.Ok(moneyEarned);
    })
    .WithName("GetPayment")
    .Produces(StatusCodes.Status200OK);
```

We follow the same procedure to instrument the remaining endpoints.

### Sending Instrumentation Data to Lightstep

To connect our application to Lightstep for data ingestion, we'll need an API key. First, we [create an account](https://app.lightstep.com/signup/developer?signup_source=nav) with Lightstep. Then, from the Project settings page, we copy the Token, which is our API key.

{{< img src="2.png" alt="Your API key in Lightstep" >}}

We paste that token into our `appsettings` file.

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

## Finding Common Database Issues

Our application is now ready. Let’s review our common database issues one by one.

### Chatty/Sequential interaction with database

Let’s bring the `/ems/pay/{empId}` endpoint back into focus. From an examination of the code above, you’ll see that this endpoint makes two calls to the database, one after the other.

Non-optimal, chatty database calls slow down user transactions. Granted, you will encounter cases in which you need to read a record, make a decision based on the state of the record, and then update the record. In such cases, having multiple database calls is unavoidable. For fetching records, however, you can almost always use a single query.
We launch the application (`dotnet run`) and send some requests to the `/ems/pay/{empId}` endpoint. Here is an example of a request that I sent to the endpoint:

{{< img src="3.png" alt="Request to the pay endpoint" >}}

Next, we navigate to the [Lightstep observability portal](https://app.lightstep.com/) and click on the Operations tab to see all the spans Lightstep received from the application.

{{< img src="4.png" alt="List of operations" >}}

We click on the `/ems/pay/{employeeId}` operation to view its end-to-end trace. By viewing the spans, we can ascertain the sequence of operations for any request, including database interactions. Clicking on the spans brings up its events and attributes, giving us deeper insight into the operation.

The final two spans visible in the trace are `EMSDb`, generated by our instrumented SQL Client. We click on the spans to view their attributes and events. They look like this:

{{< img src="5.png" alt="Span captured from the first database operation" >}}

{{< img src="6.png" alt="Span captured from the second database operation" >}}

From these details, we can gain some important insights:

1. The name of the database
2. The SQL statement used in the database operation
3. The type of SQL statement (text or stored procedure)
4. The hostname of the service which made the request
5. The duration of the database operation

The chatty behavior of the endpoint is very evident from the trace. A dead giveaway is the presence of two database operations in a read operation and the absence of custom traces between them to record any business logic. To resolve this issue, we need to combine the queries so that they produce a single resultset.

### Unoptimized queries

Query performance is an important metric to monitor. If queries request a large amount of data (for example, by using the `SELECT *` approach or filtering data on non-indexed fields), then the performance of the user transactions will suffer. Let’s revisit the `/emp/billing/pay-raise` endpoint:

```csharp
app.MapPost("/ems/billing/pay-raise/", async (SqlConnection db) =>
    {
        using var activity = activitySource.StartActivity("Non optimized query", ActivityKind.Server);
        var recordsAffected = await db.ExecuteAsync("UPDATE Payroll SET PayRateInUSD = 300 WHERE PayRateInUSD < 300");
        return Results.Ok(recordsAffected);
    })
    .WithName("Pay-Raise")
    .Produces(StatusCodes.Status200OK);
```

The query filters records on the `PayRateInUSD` field, which we haven’t indexed. Although this issue will not be evident in a database with a small number of records, such queries in large databases will take a lot of time. The query time is apparent in the traces collected for the endpoint, which is shown below:

{{< img src="7.png" alt="Span presenting the query duration" >}}

If the query duration exceeds the acceptable limit, you can inspect the operation further, indexing any fields used for filtering. This will speed up your database performance.

### Database Locks

Database locks are one of the most complex issues to find because they only affect the operation waiting for a lock to be released. Meanwhile, the operation acquiring the lock proceeds unaffected. However, OpenTelemetry makes it easy to detect database locks because we can view the culprit operation and the operation waiting on the lock in the same trace. Let’s discuss the code behind our offending endpoint at `/ems/payroll/remove/{empId}`:

```csharp
app.MapPost("/ems/payroll/remove/{empId}", async (int empId, SqlConnection db) =>
    {
        using var activity = activitySource.StartActivity("Db lock", ActivityKind.Server);
        activity?.SetTag(nameof(Timekeeping.EmployeeId), empId);

        Payroll payrollRecord = new();
        async Task DeleteRecord()
        {
            db.Open();
            await using var tr = await db.BeginTransactionAsync();
            await db.ExecuteAsync("DELETE FROM Payroll WHERE EmployeeId=@EmpId", new { EmpId = empId }, tr);
            Thread.Sleep(5000);
            await tr.CommitAsync();
        }

        async Task GetRecord()
        {
            await using var db1 =
                new SqlConnection(builder.Configuration.GetConnectionString("EmployeeDbConnectionString"));
            Thread.Sleep(100);
            db1.Open();
            payrollRecord =
                await db1.QuerySingleOrDefaultAsync<Payroll>(
                    "SELECT EmployeeId,PayRateInUSD FROM Payroll WHERE EmployeeId=@EmpId", new { EmpId = empId });
            await db1.CloseAsync();
        }

        await Task.WhenAll(DeleteRecord(), GetRecord());

        return Results.Ok(payrollRecord);
    })
    .WithName("RemoveEmployeeFromPayroll")
    .Produces(StatusCodes.Status200OK);
```

The `DELETE` operation begins a transaction but does not commit it for some time. This operation locks the record that will be deleted once the transaction is committed. After giving the `DELETE` transaction a little head start, we execute a `SELECT` operation to read the same record. The `SELECT` operation can’t proceed unless the `DELETE` operation releases the lock. This is clearly evident from the OpenTelemetry trace of this operation:

{{< img src="8.png" alt="Operations causing database lock" >}}

If you were to investigate these operations individually, you might assume that the `SELECT` operation is the source of the performance issue. However, the aggregated spans of the database operations point to the sequential dependency between the `DELETE` and `SELECT` operations, which will prompt you to consider their relationship with one another.

The solution for the issue is to immediately commit a transaction without waiting for any lengthy operations to complete.

### Business transactions spanning multiple services

If your user’s transactions span multiple services, then you should measure the response times of the different parts of the application and network. The `/ems/add-employee/{empId}` endpoint simulates a business transaction spread across two services as follows:

```csharp
app.MapPost("/ems/add-employee/{empId}", async (int empId, SqlConnection db) =>
    {
        using var activity =
            activitySource.StartActivity("Multiple ops in a business transaction", ActivityKind.Server);
        activity?.SetTag(nameof(Timekeeping.EmployeeId), empId);

        //op 1
        await db.ExecuteAsync("INSERT INTO Payroll Values(@EmployeeId, @PayRateInUSD)",
            new Payroll { EmployeeId = empId, PayRateInUSD = 100 });

        // Simulate service call by creating another span
        using var innerActivity = activitySource.StartActivity("Second operation of business transaction", ActivityKind.Server);
        {
            // Mock network call delay
            Thread.Sleep(1000);

            //op 2
            await db.ExecuteAsync(
                "INSERT INTO Timekeeping Values(@EmployeeId, @ProjectId, @WeekClosingDate, @HoursWorked)",
                new Timekeeping
                    { EmployeeId = empId, HoursWorked = 0, ProjectId = 1, WeekClosingDate = DateTime.Today });
        }

        return Results.Ok();
    })
    .WithName("AddEmployee")
    .Produces(StatusCodes.Status201Created);
```

Let’s look at the trace generated for this operation, which clearly shows database operations for each service.

{{< img src="9.png" alt="Business operations that requires communication between two services" >}}

The solution to such issues can vary in complexity. For a simple fix, you can optimize the network performance by placing the services physically close to one another (for example, in the same data center). A more complex approach would be to remodel the application to be eventually consistent so that you can asynchronously complete a transaction.

### Database Exceptions

Our SQL client is instrumented to capture exceptions. Lightstep understands when spans carry exception details, highlighting such operations on the dashboard. We use the `/ems/add-employee/{empId}` endpoint to insert a duplicate record in the database, which throws an exception.

Lightstep highlights the exception in the **Explorer** window as follows:

{{< img src="10.png" alt="Exceptions highlighted in explorer window" >}}

Clicking on the operation shows us the exception details captured as an event.

{{< img src="11.png" alt="Exceptions details captured as event" >}}

We can use OpenTelemetry to record critical state changes and exceptions in the form of events, using the information to debug issues when they occur.

## Conclusion

This article discussed how OpenTelemetry can be used to easily detect performance issues in an application database. The performance of an application database should be monitored in concert with user transactions. This helps us to avoid making unnecessary, low-value database optimizations.

Without altering the database in any manner, we instrumented a simple application to surface several types of database performance issues. With sufficient context, we can either quickly fix the underlying issue, or we can confidently develop a plan to improve the performance of our database.

{{< subscribe >}}
