---
title: Event-Driven Architecture with Apache Kafka for .NET Developers Part 3 - Azure Event Hubs
date: 2021-04-11
tags:
  - azure
  - integration
  - programming
comment_id: 62e2dfd2-ae91-46f1-85de-7d2d108a9034
---

> In this series:
>
> 1. [Development environment and Event producer](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/)
> 2. [Event consumer](/post/event-driven-architecture-with-apache-kafka-for-.net-developers-part-2-event-consumer/)
> 3. Azure Event Hubs integration (this article)

[Azure Event Hubs](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-about) is a horizontally scalable event ingestion service capable of receiving and processing millions of events per second. It [supports Apache Kafka Producer and Consumer API](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-for-kafka-ecosystem-overview) that you can use as an alternative to running a self-managed Apache Kafka cluster. Now you can integrate the Kafka ecosystem applications such as Kafdrop and many others with Event Hubs. Please visit the [Microsoft documentation website](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-for-kafka-ecosystem-overview) to read about using Azure Event Hub as the messaging backplane for an Apache Kafka application in detail.

We will now extend the TimeOff application to use Kafka running in Docker in local and CI/CD environments and use Event Hubs in other environments. By building the new features of the application, you will also understand the process of migrating your application that uses self-hosted or managed Kafka cluster to Event Hubs.

One of our application's crucial components is the Schema Registry, which stores and enforces schemas between producers and consumers of events. [Azure Schema Registry](https://docs.microsoft.com/en-us/azure/event-hubs/schema-registry-overview) is an optional new feature of Event Hubs that acts as a central repository for schema documents. Functionally, it is similar to the Confluent Schema Registry, and you can use it to enforce constraints during the message serialization and deserialization processes.

We will extend our application to use Azure Schema Registry in non-local environments and Confluent Schema Registry in the local environment. Let me begin by pointing you to the code repository again.

## Source Code

The complete source code of the application and other artifacts is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/kafka-lms" >}}

## Azure Services Setup: Event Hubs

Navigate to the [Azure Management Portal](https://portal.azure.com/) and create a new [Event Hubs namespace](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-create). I named my Event Hubs namespace - **timeoff-eh**. You can choose any available unique name for your namespace resource. Note that the Schema Registry service is only available in the standard or higher tiers. So, please select the pricing tier accordingly.

{{< img src="1.png" alt="Create Event Hubs namespace" >}}

Let's copy the connection string of the namespace from the portal, which we will later use in our application.

{{< img src="2.png" alt="Copy Event Hubs namespace connection string" >}}

We used the Kafka Admin API in our application to create new Kafka topics on the fly. Since Event Hubs do not support the Kafka Admin API, we will create the two topics that we require - **leave-applications** (3 partitions) and **leave-applications-results** (1 partition) as Event Hubs instances as follows:

{{< img src="3.png" alt="Create a new Event Hub" >}}

Remember that with Event Hubs, a Kafka topic corresponds to an Event Hubs instance. The rest of the concepts, such as the partitions, consumer groups, and event receivers, remain the same. You can manually add consumer groups or let the Kafka Consumer API create them automatically (no change required in our application).

{{< img src="4.png" alt="Consumer groups of an Event Hub" >}}

By now, you should have two Event Hubs instances with the appropriate partition count in your namespace as follows:

{{< img src="5.png" alt="Event Hubs in namespace" >}}

Let's now create a Schema Registry.

## Azure Services Setup: Schema Registry

Let's create a new Schema Registry in our Event Hubs namespace. Note that Schema Registry is an independent feature that you can also use with other messaging services such as Service Bus and Azure Queues. We will first create a Schema Group that is used to manage a collection of schemas. You might want to create a Schema Group per domain or application.

Click on the **Schema Registry** option in your Event Hubs namespace, under **Entities** and select the option to create a new Schema Group as follows:

{{< img src="6.png" alt="Create schema group" >}}

Enter the schema group's name - **time-off-schema**, the serialization format - **Avro**, and the compatibility mode.

We now need to grant access to our application to communicate with the Schema Registry to add missing schemas and read existing schemas. Azure recommends using Role-Based Access Control (RBAC) to grant required access to resources. Let's register the TimeOff application in our Active Directory. You can read about the application registration process in detail on the [Microsoft docs website](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal).

Navigate to your Active Directory instance and click on **App registrations** and select the **New registration** option as follows:

{{< img src="7.png" alt="Create new app registration" >}}

Enter the name of the application and click on the **Register** button.

{{< img src="8.png" alt="Register TimeOff application" >}}

Let's now create a new client secret for our application by clicking on **Certificates and secrets** and next on the **New secret** option. Fill in the required details for the secret as follows:

{{< img src="9.png" alt="Create new secret" >}}

Record the secret from the next screen. The secret will be displayed once so, make sure that you do not lose the secret value.

{{< img src="10.png" alt="Record secret value" >}}

Also, record the Application's Client Id and Tenant Id from the overview page as follows:

{{< img src="11.png" alt="Record client id and tenant id" >}}

Let's now assign the Schema Registry role for the TimeOff application. Assign the **Schema Registry Contributor** role to the TimeOff application as follows, which allows adding schema to the group programmatically if it does not exist:

{{< img src="12.png" alt="Assign role to TimeOff application" >}}

Let's now update the application code to switch to Event Hubs based on a configuration setting.

## Updating Producer: Employee Service

Expand the **TimeOff.Employee** project and add the setting **IsLocalEnvironment** with value _false_ in the **appsettings.json** file. The value of the **IsLocalEnvironment** setting will determine whether we use Event Hubs and Azure Schema Registry or Kafka in Docker and Confluent Schema Registry in our application.

Based on the value of the setting, create a new object of `ProducerConfig` that is initialized from the Event Hubs details as follows:

```cs
var config = new ProducerConfig()
{
    BootstrapServers = "<EH namespace>.servicebus.windows.net=9093",
    EnableDeliveryReports = true,
    SaslUsername = "$ConnectionString",
    SaslPassword = "<EH namespace connection string>"
};

config.ClientId = Dns.GetHostName();
config.SecurityProtocol = SecurityProtocol.SaslSsl;
config.SaslMechanism = SaslMechanism.Plain;
```

Next, we need to initialize the Schema Registry client `SchemaRegistryClient` that we will use to interact with Azure Schema Registry as follows:

```cs
var schemaRegistryClientAz = new SchemaRegistryClient("<EH namespace>.servicebus.windows.net", new DefaultAzureCredential());
```

The [`DefaultAzureCredential`](https://docs.microsoft.com/en-us/dotnet/api/overview/azure/identity-readme#defaultazurecredential) allows you to switch identities based on the environment. The `DefaultAzureCredential` class combines several identity classes that are used to fetch Azure Active Directory identity. At runtime, `DefaultAzureCredential` starts attempting to initialize one of the identity classes beginning with `EnvironmentCredential` and finishing with `InteractiveBrowserCredential`. Whichever identity class is initialized first will be used for authenticating the resource API calls. You can read more about the Azure Schema Registry library for .NET from [the ReadMe file of the SDK](https://github.com/Azure/azure-sdk-for-net/tree/master/sdk/schemaregistry/Microsoft.Azure.Data.SchemaRegistry.ApacheAvro).

Let's add the following environment variables used by the `EnvironmentCredential` class to our application in the **launchsettings.json** file. Schema Registry client will use the credentials to authenticate the requests sent to create or read schemas from the registry. Note that we are adding these credentials to the launch settings file to aid us in the debugging process and simulate the application's behavior in non-local environments.

```json
{
  "profiles": {
    "TimeOff.Employee": {
      "commandName": "Project",
      "environmentVariables": {
        "AZURE_CLIENT_SECRET": "<TimeOff application client secret>",
        "AZURE_CLIENT_ID": "<TimeOff application client ID>",
        "AZURE_TENANT_ID": "<TimeOff application tenant ID>"
      }
    }
  }
}
```

If you observe the `SetKeySerializer` method in the `ProducerBuilder` class of the Kafka Producer API, you will notice that it requires an object of type `IAsyncSerializer`. The serializer implementation takes an object and returns a byte array. Let's create an implementation of `IAsyncSerializer` that serializes an object with the schema and returns a byte array as follows:

```cs
public class KafkaAvroAsyncSerializer<T> : IAsyncSerializer<T>
{
    private readonly SchemaRegistryAvroObjectSerializer _serializer;

    public KafkaAvroAsyncSerializer(SchemaRegistryClient schemaRegistryClient, string schemaGroup,
        bool autoRegisterSchemas = true)
    {
        _serializer = new SchemaRegistryAvroObjectSerializer(
            schemaRegistryClient,
            schemaGroup,
            new SchemaRegistryAvroObjectSerializerOptions
            {
                AutoRegisterSchemas = autoRegisterSchemas
            });
    }

    public async Task<byte[]> SerializeAsync(T data, SerializationContext context)
    {
        if (data == null)
        {
            return null;
        }

        // SchemaRegistryAvroObjectSerializer can only serialize GenericRecord or ISpecificRecord.
        if (data is string s)
        {
            return Encoding.ASCII.GetBytes(s);
        }

        await using var stream = new MemoryStream();
        await _serializer.SerializeAsync(stream, data, typeof(T), CancellationToken.None);
        return stream.ToArray();
    }
}
```

Note that the Azure Schema Registry serializer can only serialize objects of either `GenericRecord` or `ISpecificRecord` type. Since our message keys are of `string` type, we handled the special case of serializing the `string` type data.

I will digress a little and draw your attention to the `SetKeyDeserializer` method of the `ConsumerBuilder` class that uses an implementation of type `IDeserializer` to deserialize the messages received from the Kafka topic. Let's write a custom implementation of `IDeserializer` for our application as follows:

```cs
public class KafkaAvroDeserializer<T> : IDeserializer<T>
{
    private readonly SchemaRegistryAvroObjectSerializer _serializer;

    public KafkaAvroDeserializer(SchemaRegistryClient schemaRegistryClient, string schemaGroup)
    {
        _serializer = new SchemaRegistryAvroObjectSerializer(schemaRegistryClient, schemaGroup);
    }

    public T Deserialize(ReadOnlySpan<byte> data, bool isNull, SerializationContext context)
    {
        if (data.IsEmpty)
        {
            return default;
        }

        // SchemaRegistryAvroObjectSerializer can only serialize GenericRecord or ISpecificRecord.
        if (typeof(T) == typeof(string))
        {
            return (T) Convert.ChangeType(Encoding.ASCII.GetString(data.ToArray()), typeof(T));
        }

        return (T) _serializer.Deserialize(new MemoryStream(data.ToArray()), typeof(T), CancellationToken.None);
    }
}
```

Following is the complete code listing that creates an appropriate Schema Registry client based on the application's environment. Based on the Schema Registry selected, the `IProducer` client is created that can submit messages to a Kafka topic:

```cs
CachedSchemaRegistryClient cachedSchemaRegistryClient = null;
KafkaAvroAsyncSerializer<string> kafkaAvroAsyncKeySerializer = null;
KafkaAvroAsyncSerializer<LeaveApplicationReceived> kafkaAvroAsyncValueSerializer = null;

if (Convert.ToBoolean(Configuration["IsLocalEnvironment"]))
{
    cachedSchemaRegistryClient = new CachedSchemaRegistryClient(schemaRegistryConfig);
}
else
{
    var schemaRegistryClientAz =
        new SchemaRegistryClient(Configuration["SchemaRegistryUrlAz"], new DefaultAzureCredential());
    var schemaGroupName = "time-off-schema";
    kafkaAvroAsyncKeySerializer =
        new KafkaAvroAsyncSerializer<string>(schemaRegistryClientAz, schemaGroupName);
    kafkaAvroAsyncValueSerializer =
        new KafkaAvroAsyncSerializer<LeaveApplicationReceived>(schemaRegistryClientAz, schemaGroupName);
}

using var producer = new ProducerBuilder<string, LeaveApplicationReceived>(config)
    .SetKeySerializer(Convert.ToBoolean(Configuration["IsLocalEnvironment"])
        ? new AvroSerializer<string>(cachedSchemaRegistryClient)
        : kafkaAvroAsyncKeySerializer)
    .SetValueSerializer(Convert.ToBoolean(Configuration["IsLocalEnvironment"])
        ? new AvroSerializer<LeaveApplicationReceived>(cachedSchemaRegistryClient)
        : kafkaAvroAsyncValueSerializer)
    .Build();
```

We do not need to make any other changes to the rest of the project because the Kafka Producer and Client APIs are fully compatible with Event Hubs. The Schema Registry APIs are proprietary to Confluent, and hence we had to make changes to the serializer and deserializer implementation. Microsoft has [identified the problems with proprietary Schema Registry APIs](https://techcommunity.microsoft.com/t5/messaging-on-azure/public-preview-of-the-azure-schema-registry-in-azure-event-hubs/ba-p/1699878) and submitted a [vendor-neutral API specification to CNCF](https://github.com/cloudevents/spec/blob/master/schemaregistry/schemaregistry.md). If Schema Registry vendors adhere to a standard specification, we would not need to make any changes to the application.

## Updating Consumer: Manager Service

The Manager service is responsible for consuming and producing events. In addition to the changes that I described previously, we need to make a small change to integrate Schema Registry deserializer in the `IConsumer` consumer client as follows:

```cs
CachedSchemaRegistryClient cachedSchemaRegistryClient = null;
KafkaAvroDeserializer<string> kafkaAvroKeyDeserializer = null;
KafkaAvroDeserializer<LeaveApplicationReceived> kafkaAvroValueDeserializer = null;

if (Convert.ToBoolean(Configuration["IsLocalEnvironment"]))
{
    cachedSchemaRegistryClient = new CachedSchemaRegistryClient(schemaRegistryConfig);
}
else
{
    var schemaRegistryClientAz =
        new SchemaRegistryClient(Configuration["SchemaRegistryUrlAz"], new DefaultAzureCredential());
    var schemaGroupName = Configuration["SchemaRegistryGroupNameAz"];
    kafkaAvroKeyDeserializer =
        new KafkaAvroDeserializer<string>(schemaRegistryClientAz, schemaGroupName);
    kafkaAvroValueDeserializer =
        new KafkaAvroDeserializer<LeaveApplicationReceived>(schemaRegistryClientAz, schemaGroupName);
}

using var consumer = new ConsumerBuilder<string, LeaveApplicationReceived>(consumerConfig)
    .SetKeyDeserializer(
        Convert.ToBoolean(Configuration["IsLocalEnvironment"])
            ? new AvroDeserializer<string>(cachedSchemaRegistryClient).AsSyncOverAsync()
            : kafkaAvroKeyDeserializer)
    .SetValueDeserializer(Convert.ToBoolean(Configuration["IsLocalEnvironment"])
        ? new AvroDeserializer<LeaveApplicationReceived>(cachedSchemaRegistryClient).AsSyncOverAsync()
        : kafkaAvroValueDeserializer)
    .SetErrorHandler((_, e) => Console.WriteLine($"Error: {e.Reason}"))
    .Build();
```

Please use the concepts that we discussed and the source code of the application in the GitHub repository as a guide to update the code of the Manager service and the ResultReader service.

## Application Demo

Let's check whether everything works as expected. Let's launch the Employee service and submit a new leave application.

{{< img src="13.png" alt="Employee service: Add a new leave application" >}}

The [Azure Event Hubs Capture feature](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-capture-overview) enables you to periodically capture and persist streaming data from Event Hubs to Azure Blob storage or Azure Data Lake Store. You can easily configure this feature through the management portal by following the [instructions on the Microsoft documentation website](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-capture-enable-through-portal). Following is a screenshot of the file stored in Azure Blob storage that contains the event that we recorded in the Event Hubs. Note that the Avro syntax formatter is not available in the portal. Hence you would see some Unicode text in the editor window.

{{< img src="14.png" alt="View event in Azure blob storage" >}}

Let's now launch the Manager service to view the recorded leave application and action it as follows:

{{< img src="15.png" alt="Manager service: Reject leave application" >}}

Finally, let's view the status of the leave application by launching a new instance of the ResultReader service as follows:

{{< img src="16.png" alt="Result reader service: View status of leave application" >}}

You can view the Avro schema files in the **time-off-schema** group as follows:

{{< img src="17.png" alt="View schema in schema registry" >}}

## Conclusion

In this article, we extended our application to use Event Hubs for messaging. Event Hubs support the Kafka Producer and Consumer APIs, and so we did not have to make any changes to the parts of our application that produce and consume events. However, we had to create Event Hub instances through the portal because Event Hubs do not support the Kafka Admin APIs. We plugged a custom serializer and deserializer into our application to replace proprietary Confluent Schema Registry APIs.

I hope you enjoyed reading the articles in this series, and you gained the confidence to migrate existing applications or create new applications that use Kafka for messaging. Your feedback is a crucial component of my writing. Please share your comments and questions in the comments section or on my Twitter handle [@rahulrai_in](https://twitter.com/rahulrai_in).
