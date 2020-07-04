---
title: "IoT Edge Device Monitoring and Management with Azure Durable Entities Functions - Part 2"
date: 2019-07-13
tags:
  - azure
  - internet-of-things
  - compute
---
{{% notice %}}
In this series

1. [IoT Edge Application](/post/iot-edge-device-monitoring-and-management-with-azure-durable-entities-functions-part-1/)
2. [Azure Durable Entities Function](/post/iot-edge-device-monitoring-and-management-with-azure-durable-entities-functions-part-2/)
   {{% /notice %}}

In the last article, we built and tested a simple IoT Edge application that simulates temperature telemetry based on the command that it receives. We also created a test client that can invoke Direct Method on the device.

Today we will build monitoring and management capabilities for our IoT Edge device using Azure Functions. One critical consideration that I would like to bring to your attention is the demand for this solution to stay mostly connected. Not every Edge device enjoys mostly available connectivity, and therefore, the Edge device should have the intelligence to understand the data and act on it without waiting for a long time for instructions from the cloud.

## Source Code

Before we proceed further, I would like to direct you to the source code of the application available on my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/MeltingBoiler" >}}

The repository comprises three applications organized using the following folder structure.

1. **edge**: This folder contains the IoT Edge application that generates telemetry and handles C2D commands.
2. **generator**: This folder contains a simple console application that can test the IoT Edge application.
3. **function**: This folder contains the Azure Function, which reacts to the telemetry that it receives from IoT Hub by issuing commands to IoT Edge application.

## Azure Durable Functions

If you worked with the previous version of Azure Functions (v1), you must have realized how difficult it is to orchestrate functions together to form workflows and how tedious it is to store a workflow state durably. Durable Functions (or Azure Functions v2) uses Azure Storage services such as tables, queues, and blobs to allow you to write stateful functions. The most significant advantage of the Durable Functions is the ease that it grants to the developers to define complex workflows without worrying about the state. You can now build a function that calls multiple other functions, manipulates its state, and save the state locally without worrying about creating checkpoints or storing the progress of the workflow. To read more about Durable Functions, go through the [official documentation](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview). It is essential to understand the different functions that collectively form Durable Functions. You can read about them [here](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-types-features-overview).

You can use Visual Studio or VSCode to build Durable Functions. To set up your system and create a new function, follow the steps mentioned in the [official documentation here](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-create-first-csharp). I named my Function application **SafeguardFunction**, choose an appropriate name for your function. Let's build features for our app one at a time.

## Ingest Data From IoT Hub

Create a folder named `Clients` in the project. This folder will contain Client functions that spawn new orchestrator functions. An Orchestrator function is responsible for driving the workflow by invoking one or more Activity functions. An activity, defined by the Activity function, is the smallest unit of work in Durable Functions. An activity can return data to the orchestrator so that the orchestrator can make decisions to drive the workflow.

Create a new class in the folder named `IoTHubClient`. This client receives data as it arrives from the IoT Hub and starts an instance of the orchestrator. On every initiation, the Orchestrator function returns a new ID. This ID can be used to monitor the progress of the workflow and to terminate it if required. We will save the workflow ID in the logs. Update the code in the class with the code from the following listing.

```cs
[FunctionName(nameof(IoTHubClient))]
public static async Task RunClient(
    [IoTHubTrigger("messages/events", Connection = "IoTHubTriggerConnection")]
    EventData message,
    [OrchestrationClient] IDurableOrchestrationClient client,
    ILogger logger)
{
    var messageResult = JsonConvert.DeserializeObject<dynamic>(Encoding.ASCII.GetString(message.Body.Array));
    var instanceId = await client.StartNewAsync(nameof(SafetySequenceOrchestrator),
        new KeyValuePair<string, double>(message.SystemProperties["iothub-connection-device-id"].ToString(), (double)messageResult.CurrentTemperature));
    logger.LogInformation($"Started orchestration with ID = '{instanceId}'.");
}
```

IoT Hub exposes the messages/events built-in endpoint for the back-end services to read the device-to-cloud messages received by the hub. The trigger reads the IoT Hub connection string from the _local.settings.json_ file during development and from an environment variable after deployment. The `OrchestratorClient` attribute informs the runtime to treat this function as an orchestrator client. Using the client object, we start a new instance of the `SafetySequenceOrchestrator` orchestrator and pass an argument in the form of a KeyValue pair with the name of the Edge device and the reported telemetry.

Next, let's build the Orchestrator and the Durable Entity that will act as the twin of the Edge device. Create a new folder named `Orchestrators` and add a file named `SafetySequenceOrchestrator` to it. Add an orchestrator function to the class by applying the code from the following code listing to the class.

```cs
[FunctionName(nameof(SafetySequenceOrchestrator))]
public static async Task Run([OrchestrationTrigger] IDurableOrchestrationContext context, ILogger logger)
{
    try
    {
        var (key, value) = context.GetInput<KeyValuePair<string, double>>();
        var deviceId = new EntityId(nameof(DeviceMonitor), key);
        using (await context.LockAsync(deviceId))
        {
            await context.CallEntityAsync(deviceId, Constants.ActorOperationAddRecord,
                new KeyValuePair<DateTime, double>(context.CurrentUtcDateTime, value));
            var isMelting = await context.CallEntityAsync<bool>(deviceId, Constants.ActorOperationIsMelting);
            if (isMelting)
            {
                // safety sequence
                await context.CallActivityWithRetryAsync(nameof(SendApprovalRequest), Policies.Retry,
                    context.InstanceId);
                var automaticApprovalTask = context.CallActivityWithRetryAsync<bool>(
                    nameof(AutoRequestApproval),
                    Policies.Retry,
                    new KeyValuePair<string, double>(key, value));
                var humanInterventionTask =
                    context.WaitForExternalEvent(Constants.ManualApproval, TimeSpan.FromMinutes(2), true);
                if (humanInterventionTask == await Task.WhenAny(humanInterventionTask, automaticApprovalTask))
                {
                    await context.CallEntityAsync(deviceId, Constants.ActorOperationSendInstruction,
                        humanInterventionTask.Result);
                }
                else
                {
                    await context.CallEntityAsync(deviceId, Constants.ActorOperationSendInstruction, true);
                }

                await context.CallEntityAsync(deviceId, Constants.ActorOperationReset);
            }
        }
    }
    catch (Exception e)
    {
        logger.LogError(e, e.ToString());
    }
}
```

Let's go through the code that we applied just now. Just like orchestrator clients, the runtime recognizes the orchestrators by the `OrchestrationTrigger` attribute. Inside the function, we extract the argument sent to the orchestrator by the orchestration client. Next, we create an entity ID for the durable entity with which we want to interact. To uniquely identify an entity, we will use the name of the Edge device as the key of the entity.

To prevent the entity that we are working with from participating in other operations, we request the runtime to acquire a lock on the entity using the identity of the entity. Our entity supports multiple operations, each of which can be invoked by using the `CallEntityAsync` function and passing the name of the operation as an argument. We first request the entity to add the recently received data to its state. Next, we ask the entity to go through its state and report whether it has reached the critical temperature threshold. If the orchestrator receives an affirmative response from the device twin, it starts the safety sequence workflow.

In the first step of the sequence, the orchestrator invokes the `SendApprovalRequest` activity function. On receiving this command, the activity sends a Slack message to the operator with an option to either ignore the notification or send a Direct Command to the Edge device to turn off the boiler. We will discuss Azure function and Slack integration soon in this article.

The orchestrator starts two more activities after dispatching the Slack message. The first activity, named `AutoRequestApproval`, waits for some time before returning the value _true_ as the response. The second activity waits for a function to raise an external event. This external event will be raised by the `ManualRequestApproval` function when it receives an HTTP request from the Slack notification. Based on whichever activity returns the response first, the orchestrator invokes a command on the durable entity to either ignore the alert or send an instruction to the Edge device to turn off the boiler.

After creating the orchestrator, we'll enable Azure Function and Slack integration.

## Durable Functions and Slack Integration

For this step, we would need to create an application in Slack first. Navigate to the [Slack developer portal](https://api.slack.com/apps) and click on the **Create New App** button. Enter the name of your application and select the workspace for your application. If you don't already have a workspace, follow the instructions [documented here](https://get.slack.help/hc/en-us/articles/206845317-Create-a-Slack-workspace) to create one.

In the following page, Slack will ask you to enable features for your app. First, enable the **Incoming Webhooks** feature and select the **Add New Webhook to Workspace** option. We will send alerts to the webhook endpoint in the form of a [specially formatted JSON](https://api.slack.com/tools/block-kit-builder).

{{< img src="1.png" alt="Enable Slack Webhooks" >}}

Next, navigate to the **Interactive Components** feature and turn it on. Using this feature, you can create interactive buttons that can post the user action in the form of an HTTP request to any endpoint you specify. The form will ask you to enter a URL that it will post messages to when the user interacts with the message. For testing the function on your local system, you would need to use a utility like [ngrok](https://ngrok.com/) to expose the function to the internet. Remember to enter a value in this field after running the function on your system and exposing it through ngrok.

{{< img src="2.png" alt="Enable Slack Interactivity Feature.png" >}}

Finally, head back to the **Basic Information** section and follow the prompts to install the application to your workspace.

{{< img src="3.png" alt="Install Slack App To Workspace" >}}

We will now create an activity trigger function that will send alert messages to the Slack application that we just created. Create a folder named `Triggers` and add a class named `SendApprovalRequest` to it. Copy the code from the following snippet and paste it in the class.

```CS
public static class SendApprovalRequest
{
    [FunctionName(nameof(SendApprovalRequest))]
    public static async Task Run([ActivityTrigger] string instanceId, ILogger logger)
    {
        var approvalRequestUrl =
            Environment.GetEnvironmentVariable("Slack:ApprovalUrl", EnvironmentVariableTarget.Process);
        var approvalMessageTemplate =
            "{\"text\":\"*Alert!!* Simulated Sensor is reporting critical temperatures.\",\"attachments\":[{\"text\":\"Shut down *Boiler1*?\",\"fallback\":\"You are unable to choose an option\",\"callback_id\":\"" +
            instanceId +
            "\",\"color\":\"#3AA3E3\",\"attachment_type\":\"default\",\"actions\":[{\"name\":\"approve\",\"text\":\"YES\",\"type\":\"button\",\"value\":\"true\"},{\"name\":\"approve\",\"text\":\"NO\",\"type\":\"button\",\"value\":\"false\"}]}]}";
        var approvalMessage = approvalMessageTemplate;
        string resultContent;
        using (var client = new HttpClient())
        {
            client.BaseAddress = new Uri(approvalRequestUrl);
            var content = new StringContent(approvalMessage, Encoding.UTF8, "application/json");
            var result = await client.PostAsync(approvalRequestUrl, content);
            resultContent = await result.Content.ReadAsStringAsync();
            if (result.StatusCode != HttpStatusCode.OK)
            {
                throw new HttpRequestException(resultContent);
            }
        }

        logger.LogInformation("Message sent to Slack!");
    }
}
```

When invoked, the `SendApprovalRequest` activity sends a POST request to the webhook endpoint that we provisioned for the Slack app earlier. The orchestrator function that we built previously will invoke this activity. If you observe the message content, you would see that it defines two interactive buttons to be added to the message body. Based on the button that the user clicks, Slack will send a request to the API endpoint that we specified in the **Interactive Components** section of our Slack app configuration. Let's now build the function that will receive the messages from Slack.

In the **Clients** folder, add a new class named `ManualRequestApproval`. Just like the `IoTHubClient` function, `ManualRequestApproval` is an orchestration client function. Revisit the code that you wrote for the `SafetySequenceOrchestrator` orchestrator function where you can see that the orchestrator waits for two minutes for an external event named `ManualApproval` to occur. If it does not receive the event within the stipulated duration, it uses the instruction that it receives from the `AutoRequestApproval` activity to send a command to the IoT Edge device. Apply the code from the following code listing to the `ManualRequestApproval` class.

```cs
public static class ManualRequestApproval
{
    [FunctionName(nameof(ManualRequestApproval))]
    public static async Task Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, Constants.Post, Route = Constants.ManualApprovalRoute)]
        HttpRequestMessage request,
        [OrchestrationClient] IDurableOrchestrationClient client,
        ILogger logger)
    {
        var formData = await request.Content.ReadAsFormDataAsync();
        var payload = formData.Get("payload");
        dynamic response = JsonConvert.DeserializeObject(payload);
        string instanceId = response.callback_id;
        await client.RaiseEventAsync(instanceId, Constants.ManualApproval,
            Convert.ToBoolean(response.actions[0].value));
        logger.LogInformation("Raised Manual Approval event for {InstanceId} with value {Value}", instanceId,
            Convert.ToBoolean((string) response.actions[0].value));
    }
}
```

The code in the previous listing is easy to understand. It raises the `ManualApproval` event and passes the value that it receives from the interactive message that we posted to Slack. By now, we have put together all but one of the critical components of this application, the durable entity function that will act as the twin of our Edge device.

## Durable Entities As Device Twin

In the **Triggers** folder, create a class named `DeviceMonitor`. Apply the code from the following code listing to the class.

```cs
[FunctionName(nameof(DeviceMonitor))]
public static async Task Run([EntityTrigger] IDurableEntityContext context, ILogger logger)
{
    _logger = logger;
    switch (context.OperationName)
    {
        case "add-record":
            AddRecord(context);
            break;

        case "is-melting":
            context.Return(IsMelting(context));
            break;

        case "send-instruction":
            await SendInstructionAsync(context);
            break;

        case "reset":
            context.SetState(null);
            break;

        default:
            throw new NotSupportedException(context.OperationName);
    }
}
```

The `DeviceMonitor` durable entity is a function that is an independent unit of state and logic. Multiple instances of durable entities can execute simultaneously and independently of each other. They can communicate with each other and spawn other durable entities. You can see that we have defined the various operations that our entity or Actor supports. When invoked, the entity extracts the name of the operation and the parameters from the `context` and hands over the call to a handler. We will add the operation handlers used by this entity to the class now.

The following function saves the telemetry record from the device to the state. The actor stores the latest five records to the state as it needs no more data to perform any operation.

```cs
private static void AddRecord(IDurableEntityContext context)
{
    var recordedValues = context.GetState<Queue<KeyValuePair<DateTime, double>>>() ??
                            new Queue<KeyValuePair<DateTime, double>>();
    var temperature = context.GetInput<KeyValuePair<DateTime, double>>();
    recordedValues.Enqueue(temperature);
    while (recordedValues.Count > 5 && recordedValues.TryDequeue(out _))
    {
    }

    context.SetState(recordedValues);
}
```

The following function reads the data in state and reporting whether the average of reported boiler temperature has breached the critical temperature threshold.

```cs
private static bool IsMelting(IDurableEntityContext context)
{
    var recordedValues = context.GetState<Queue<KeyValuePair<DateTime, double>>>() ??
                            new Queue<KeyValuePair<DateTime, double>>();
    return recordedValues.Any(kvp => kvp.Value >= 1000) ||
            recordedValues.Average(kvp => kvp.Value) > 800 && recordedValues.Count == 5;
}
```

Finally, the following function invokes the Cloud to Device Direct Method and passes the instruction (true or false) to the command as the argument. If the Edge device receives **true** as the argument value in the Direct Method handler, it instructs the boiler to shut down; otherwise, it does nothing.

```cs
private static async Task SendInstructionAsync(IDurableEntityContext context)
{
    if (context.GetInput<bool>())
    {
        var serviceClient = ServiceClient.CreateFromConnectionString(Environment.GetEnvironmentVariable("DeviceConnectionString"));
        var cloudToDeviceMethod = new CloudToDeviceMethod("command")
        {
            ConnectionTimeout = TimeSpan.FromSeconds(5),
            ResponseTimeout = TimeSpan.FromSeconds(5)
        };
        cloudToDeviceMethod.SetPayloadJson(JsonConvert.SerializeObject(new { command = "shutdown" }));
        var response = await serviceClient.InvokeDeviceMethodAsync("myboilercontroller", "controller", cloudToDeviceMethod);
        var jsonResult = response.GetPayloadAsJson();
        _logger.LogInformation($"Device response: {jsonResult}");
    }
}
```

Launch the function in debug mode on your system (F5) and note the localhost URL that the function is executing on. Using ngrok, create an internet-accessible tunnel to your function by executing the following command.

```bash
ngrok http 7071
```

Copy the unique URL generated by ngrok to route traffic to your system and paste it in the **Interactive Components** section of the Slack setting after adding the path **/api/approval** to it. For example, the URL that I applied in the section is- http://68ce99dd.ngrok.io/api/approval.

## Showtime

Start the IoT Edge application that we built earlier and let it generate telemetry. Start the generator application and use it to make the Edge Module generate telemetry above the critical temperature threshold. Soon enough, you will receive a Slack message asking you to take action.

{{< img src="4.gif" alt="Application Demo" >}}

Remember to react to the message within two minutes of when the notification arrives; Otherwise, the automatic request approval activity will kick in and try to turn off the boiler. As soon as you click the button labelled **Yes**, the durable entity will invoke the Direct Method on the Edge device, and you will see the reported telemetry fall to the turnoff level.

## Wrap Up

In this series, we built an Edge module and monitored the device messages using a Durable Entity Azure Function. We implemented an Approval Workflow using Direct Methods on IoT Edge, Slack, and Azure Durable Function. Device monitoring and management on the cloud are beneficial for mostly connected IoT applications. I hope that you found the posts in this series useful.

{{< subscribe >}}
