---
title: "Building and Testing Reactive Microservices in Azure with Event Grid, Azure Functions, and Ngrok"
date: 2018-04-12
tags:
  - azure
  - integration
comment_id: 1f6086b6-a29d-468a-bbec-c7543564618b
---

According to the [Reactive Manifesto](https://www.reactivemanifesto.org/), a reactive system should have some essential characteristics which include: **responsiveness**, **resiliency**, **elasticity**, and being **message-driven**. Out of all the aspects, the most significant differentiating factor of Reactive Microservices from others is its characteristic of being message-driven. Using messages as the glue that holds your Microservices application together, you can design systems that isolated. High degree of isolation also helps enhance the scalability of a system which is an essential aspect of a Microservices application.

In the realms of Microsoft Azure, you can build Reactive Microservices Application using **Azure Event Grid**, **Azure Functions**, and **Logic Apps**. Azure Event Grid provides flexible event routing in the cloud, Azure Functions offer excellent Serverless execution environment for Microservices, and Logic Apps help you orchestrate the business logic of your Microservices and also provide connectivity to third-party applications and databases. In fact today Azure Functions and Logic Apps are getting adopted heavily by organizations that are trying to reshape their monolithic systems to drive more value out of them.

I won't be covering Logic Apps in this article, and I won't take your time talking about the basics of either Azure Functions or Azure Event Grid because both of them are covered extensively on the web. Here are the links to getting started guides that you can use to make yourself familiar with these services:

1. **Azure Functions**: [Click here](https://docs.microsoft.com/en-us/azure/azure-functions/functions-create-first-azure-function)
2. **Azure Event Grid**: [Click here](https://docs.microsoft.com/en-us/azure/event-grid/overview).

## Use Case

We will build a straightforward Reactive Microservices application that handles orders placed by a customer on an e-commerce application. To make this scenario as **un**realistic as possible (just to make it simple to implement), we will assume that the store has all the items available in any quantity requested. Following is a visual representation of the components that are part of the solution.

{{< img src="1.png" alt="Reactive Microservices" >}}

The solution is made up of several key components each of which we will build in this article.

**Order Service** is an API that sends a _PlaceOrder_ message to the Event Grid Topic named _OrderEvents_. The message contains essential information such as customer name, product id, shipping details, and type of event.

**Inventory Service** is a Reactive Microservice that receives the _PlaceOrder_ message and updates the status of inventory.

**Invoice Service** is another Reactive Microservice that charges the customer payment instrument for the cost of product and shipping.

## Source Code

The source code for this sample is available in my GitHub repository. {{< sourceCode src="https://github.com/rahulrai-in/ReactiveMicroservices" >}}

## Event Grid Setup: Create Topic

Since Event Grid follows the **Pub\Sub** model, it requires creating a topic to which events can be sent.

You can use PowerShell, Azure CLI, Azure Cloud Shell or the Azure Management Portal to provision all the required resources in Azure. I will use the Azure CLI to build all the resources. If you are using the Azure Cloud Shell, the instruction steps will remain the same except for the login part. You can view the download and install instructions for [Azure CLI here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli?view=azure-cli-latest).

Let's first login to the subscription where we want to set up all the resources. Executing the following command will generate a code for you with which you can log in to https://microsoft.com/devicelogin and make the sign in context available to the CLI session.

```shell
az login
```

If you want to change the subscription where you will provision all the resources, then use the following command.

```shell
az account set --subscription "Subscription Name"
```

Let's start with creating a **Resource Group** in which we will place all the resources. I have named my resource group _ecommerce-rg_ and set the location to _westus2_. You can choose a more appropriate name and a location that is geographically closer to you and also has the services available. You can check the availability of services in each location [here](https://azure.microsoft.com/en-us/global-infrastructure/services/).

```shell
az group create --name ecommerce-rg --location westus2
```

Now, let's create an **Event Grid Topic**. When you create a topic, a publically accessible endpoint to which you can post events is also generated. Due to the nature of its visibility, the name of the topic needs to be unique to the region.

```shell
az eventgrid topic create --name orderevents --location westus2 --resource-group ecommerce-rg
```

The above command creates an Event Grid Topic named _orderevents_ in the _westus2_ location in the resource group that we just provisioned. You will find a response similar to the following when the operation succeeds which lists the necessary information regarding your topic.

```json
{
  "additionalProperties": {},
  "endpoint": "https://orderevents.westus2-1.eventgrid.azure.net/api/events",
  "id": "/subscriptions/<<subscriptionid>>/resourceGroups/ecommerce-rg/providers/Microsoft.EventGrid/topics/orderevents",
  "location": "westus2",
  "name": "orderevents",
  "provisioningState": "Succeeded",
  "resourceGroup": "ecommerce-rg",
  "tags": null,
  "type": "Microsoft.EventGrid/topics"
}
```

Note down the endpoint to which you can send events from your service. You would also need to use a security key to authenticate the requests that you send to the endpoint. You can list the security keys assigned to your topic by executing the following command. Remember to substitute the topic name and the resource group name with the ones that you created.

```shell
az eventgrid topic key list --name orderevents --resource-group ecommerce-rg
```

## Publishing Events

The events that are sent to the topic need to follow a schema which is described [here](https://docs.microsoft.com/en-us/azure/event-grid/event-schema).

```json
[
  {
    "topic": string,
    "subject": string,
    "id": string,
    "eventType": string,
    "eventTime": string,
    "data":{
      object-unique-to-each-publisher
    },
    "dataVersion": string,
    "metadataVersion": string
  }
]
```

In summary, the events can be sent to the topic in an array so that you can batch multiple events together and achieve better performance. Both the publisher and the subscribers will deal with messages that adhere to this format. Any custom data can be added to the `data` property of the message by the publisher. In the scenarios where native Azure resources such as Azure Storage Blobs publish events to a topic, the `data` field contains details of the affected blob resource.

The subscribers need not receive all the messages that are sent to the topic. One of the most common filters that the clients can use to get messages of a certain type is by subscribing to events of a particular type. The `eventType` property can hold a value that can uniquely identify the type of published event.

Instead of building the **Order Service**, we will use [PostMan](https://www.getpostman.com/apps) to send a couple of events to the topic. For request authorization, add a header with key `aeg-sas-key` and the value set to one of the keys of the topic. Use the following data as the payload of the request.

```json
[
  {
    "id": "1",
    "eventType": "placeorder",
    "subject": "stationary",
    "eventTime": "2018-04-11T10:10:20+00:00",
    "data": {
      "itemId": "73",
      "itemSKU": "Paper Clips Multicolor",
      "units": "50",
      "paymentMethod": "CreditCardOnFile",
      "customerId": "7734",
      "shippingType": "Express",
      "shippingAddress": "House, Street, Suburb, City, State, Country"
    }
  }
]
```

Below is a screenshot of how you can use PostMan to send the request.

{{< img src="2.png" alt="Send Request to Topic" >}}

## Subscribing to Events

Let's now build Reactive Microservices using Azure Functions that subscribe to the events. I will use Visual Studio to create Azure Function because I want to demonstrate how you can debug a function on your local system.

In Visual Studio, select the **Azure Function** template and in the following dialog select the **Http Trigger** option and let the rest of the values set to default.

{{< img src="3.png" alt="Create Http Trigger Azure Function" >}}

Create a class named _EventGridEvent_ that has the same schema as the message schema used by the topic so that we can deserialize the messages that we receive from our subscription.

```c#
internal class EventGridEvent<T>
{
    public T Data { get; set; }
    public DateTime EventTime { get; set; }
    public string EventType { get; set; }
    public string Id { get; set; }
    public string Subject { get; set; }
    public string Topic { get; set; }
}
```

Navigate to your function and modify the content of the file to reflect what is represented in the following code fragment.

```c#
public static class InventoryFunction
{
    [FunctionName("inventoryfunction")]
    public static IActionResult UpdateInventory(
        [HttpTrigger(AuthorizationLevel.Function, "post", Route = null)] HttpRequest req,
        TraceWriter log)
    {
        log.Info("Request received");
        var requestBody = new StreamReader(req.Body).ReadToEnd();
        var receivedEvent = JsonConvert.DeserializeObject<List<EventGridEvent<Dictionary<string, string>>>>(requestBody)
            ?.SingleOrDefault();
        switch (receivedEvent?.EventType)
        {
            case "Microsoft.EventGrid.SubscriptionValidationEvent":
                var code = receivedEvent.Data["validationCode"];
                return new OkObjectResult(new { validationResponse = code });

            case "placeholder":
                // Make call to database to update inventory.
                log.Info($"Request processed. Order Id {receivedEvent.Id}");
                return new OkResult();

            default:
                return new BadRequestResult();
        }
    }
}
```

Event Grid sends two types of messages to the subscribers: **Subscription Validation** and **Notification**. A subscriber must respond to the Subscription Validation message by echoing the Validation code back to the request from Event Hub to acknowledge that it can receive messages. A Notification message contains the actual event data that needs to be processed by the function. The type of messages can be recognized by either from the request header information or the `eventType` property in the request body.

Let's review the code now. The code in the function first deserializes the incoming message into a list of `EventGridEvent` objects. Next, we determine the type of the event from the `eventType` property that is present in the body of the request. If the event is of type `Microsoft.EventGrid.SubscriptionValidationEvent`, then we extract the validation code from the body of the request and respond to the request with the code that we received. In case the event is of `Notification` type, then we update the inventory database and send a response with success message.

> Note that only the functions deployed on domains other than **azurewebsites.net** will receive the Subscription Validation message. Event Grid implicitly trusts the resources, including Logic Apps that have the Azure supplied domain names.

## Local Testing Reactive Microservices \ Azure Functions

[Ngrok](https://ngrok.com/) is a tunneling software that generates a public endpoint for services running on your local system. You can download and install Ngrok from its [website](https://ngrok.com/). After setup, start your Azure Function which in most cases would run on port 7071.

> As of today, there are some issues with executing Azure Functions v2 on the local system. [This post](https://medium.com/@tsuyoshiushio/azure-functions-v-2-0-httptrigger-with-cosmosdb-client-tips-15d313cb1cbe) proved quite useful to me in resolving many of the issues.

{{< img src="4.png" alt="Inventory Function on Localhost" >}}

Now, launch command console and write the following command to start Ngrok and create a tunnel for port 7071.

```shell
ngrok http -host-header=localhost 7071
```

After executing the command, you will get an output similar to the following.

{{< img src="5.png" alt="Ngrok Subscriber Endpoint" >}}

Note that every time you restart Ngrok, the endpoint would change. Therefore, once Ngrok starts, do not close the console window. Note down the HTTPS endpoint that Ngrok supplies as we will use this information in writing the next command. Execute the following command to create an event subscription after replacing the subscription name, resource group name, topic name, and endpoint name with the ones that you created.

```shell
az eventgrid event-subscription create --name inventoryservicesubscription --resource-group ecommerce-rg --topic-name orderevents --subject-ends-with stationary --subject-case-sensitive false --included-event-type placeorder --endpoint https://b9835b46.ngrok.io/api/inventoryfunction
```

You can see that we have included two filters in the command. The `subject-ends-with` filter allows only the messages that have the `subject` field in the event ending with _stationary_ to pass through. The filters currently don't support wildcards and regular expressions. Another filter named `subject-starts-with` performs a similar function but analyses the strings from the beginning.

Another filter that we have configured in the command is the `included-event-type` filter. This filter works on the `eventType` property of the event. You can include multiple events types in the parameter value string with each type separated by a space.

During the creation of event subscription, you would notice that the function gets invoked while the command is still executing. As part of the creation of subscription, a Subscription Validation message is sent to your function to validate whether it can receive requests. Following is a screenshot of the message containing the response validation code.

{{< img src="6.png" alt="Response Validation Code" >}}

You can now try sending a couple of more messages to the topic using PostMan just like we did previously. The following is a capture of a message that was processed by the function.

{{< img src="7.png" alt="Events Sent to Azure Function" >}}

## Conclusion

Event Grid is a remarkable new service that can help build enterprise-grade Reactive Microservices. Event Grid is an excellent integration technology that can connect services irrespective of where they are hosted. Adding Event Grid to Serverless technologies reduces infrastructure overheads and allows organizations to take advantage of the scale and flexibility that cloud offers.

{{< subscribe >}}
