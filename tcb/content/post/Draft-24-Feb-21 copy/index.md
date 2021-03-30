---
title: Event-Driven Architecture with Apache Kafka for .NET Developers Part 2 - Event Consumer
date: 2021-03-30
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

> In this series:
>
> 1. [Development environment and Event producer](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/)
> 2. Event consumer (this article)
> 3. Azure integration (coming soon)

Let's carry our discussion forward and implement a consumer of the events that the **Employee service** published to the **leave-applications** Kafka topic. We will extend the application that we developed earlier to add two new services to demonstrate how Kafka consumers work: **Manager service** and **Result reader service**.

## Source Code

The complete source code of the application and other artifacts is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/kafka-lms" >}}

## Consumer Example: Manager Service

The Manager service acts as both a consumer and a producer of events. The service reads the leave applications from the **leave-applications** topic (consumer), synchronously records the manager's decision on the application, and publishes the result as an event named **leave application processed** to the **leave-applications-results** Kafka topic (publisher).

Since we previously discussed the Publisher API and its implementation in the Employee service in detail in the previous article, I will not cover the Manager service producer feature. I encourage you to attempt building the publisher feature of the service using my version of the source code as a guide.

Launch your Visual Studio or VS Code to create a new .NET Core console application named **TimeOff.Manager** in the same solution as the Employee service. For reference, you can locate this project in the [GitHub repository](https://github.com/rahulrai-in/kafka-lms) with the same name.

As before, we will install the following NuGet packages to our project to enable our application to understand how to produce and consume messages:

```powershell
Install-Package Confluent.Kafka
Install-Package Confluent.SchemaRegistry.Serdes.Avro
```

Open the **Program** class file in your editor and begin populating the `Main` method as per the directions. The Kafka consumer API can be accessed through an instance of the `IConsumer` class. As before, we need the Schema Registry client (`CachedSchemaRegistryClient`) to enforce schema constraints on the consumer.

Similar to the producer client, the consumer client requires certain initialization parameters, such as the Bootstrap servers, which is the list of brokers that the client will connect to initially. Use the following code to create the configurations that will be used to initialize the clients.

```cs
var schemaRegistryConfig = new SchemaRegistryConfig { Url = "http://127.0.0.1:8081" };
var consumerConfig = new ConsumerConfig
{
    BootstrapServers = "127.0.0.1:9092",
    GroupId = "manager",
    EnableAutoCommit = false,
    EnableAutoOffsetStore = false,
    // Read messages from start if no commit exists.
    AutoOffsetReset = AutoOffsetReset.Earliest
};
```

Let's discuss the initialization properties and their values in a little more detail. Multiple consumers can be grouped into a consumer group that is uniquely identified by a `GroupId`. Kafka will automatically balance the allocation of partitions to consumers belonging to the same consumer group.

As consumers go about reading messages from a partition, they store a pointer to the position within the partition (called offset) within Kafka. Kafka stores this information in a topic named **\_\_consumer_offsets**. If a consumer resumes processing after a delay due to scheduled shutdowns or application crashes, it can resume processing messages from where it left earlier.

The Kafka .NET client can automatically record and store offsets preiodically in Kafka. For better control, we can turn off the automatic offset persistence process by setting the value of the setting the value of `EnableAutoCommit` property to false. The automatic offset persistence feature uses an in-memory database to record the offsets. We can safely turn off the database feature by setting the value of the property `EnableAutoOffsetStore` to false as well.

When you start a consumer it can be configured to start reading data from the latest recorded offset, or in its absence, the beginning of the partition. By default, the consumer receives the messages that are queued to its partitions after the consumer process is started. We do not want to lose messages in case our consumer crashes, so we will set the value of property `AutoOffsetReset` to `AutoOffsetReset.Earliest`.

Let's continue writing the message consumer logic as follows:

```cs
using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var consumer = new ConsumerBuilder<string, LeaveApplicationReceived>(consumerConfig)
    .SetKeyDeserializer(new AvroDeserializer<string>(schemaRegistry).AsSyncOverAsync())
    .SetValueDeserializer(new AvroDeserializer<LeaveApplicationReceived>(schemaRegistry).AsSyncOverAsync())
    .SetErrorHandler((_, e) => Console.WriteLine($"Error: {e.Reason}"))
    .Build();
{
    try
    {
        consumer.Subscribe("leave-applications");
        while (true)
        {
            var result = consumer.Consume();
            var leaveRequest = result.Message.Value;

            // Make decision on leave request.
            var isApproved = ReadLine.Read("Approve request? (Y/N): ", "Y")
                .Equals("Y", StringComparison.OrdinalIgnoreCase);
            // TODO: Send response to the leave-applications-results topic.
            consumer.Commit(result);
            consumer.StoreOffset(result);
        }
    }
    finally
    {
        consumer.Close();
    }
}
```

Let's discuss the code listing in detail. We created an instance of the `CachedSchemaRegistryClient` class to access the Schema Registry. Next, we created an instance of the class `Consumer` which implements the `IConsumer` interface. Kafka exposes the message consumer capabilities through the `IConsumer` interface. Since a consumer only needs to understand the mechanics of deserializing the message key and value, we bolted on the Avro key and value deserializers to the `IConsumer` instance.

To link a consumer to a of topic, you need to invoke the **Subscribe** method with the name of the topic. You can also pass a list of topic names to another overload of the the **Subscribe** method if you are interested in consuming messages from several topics simultaneously.

The Kafka .NET client spawns several background threads that prefetch messages from the topics in which the consumer is interested. You can retrieve those messages one at a time by invoking the `Consume` method. The `Consume` method must be invoked in a loop so that it can receive all the messages that the background threads fetched. In case of failures during processing the `Close` method will persist any in-memory offsets and instruct Kafka to rebalance the partitions so that the partitions attached to this consumer are allocated to another client.

The `Commit` method commits the offset of the processed message and the `StoreOffset` method immediately records the offsets in Kafka. Committing and storing the offsets frequently is my preferred approach as it ensures that we won't end up processing several messages again on service disruptions.

Let's launch this application and verify whether it processes the messages that we published on the topic earlier (previous article).

## Conclusion

In this article we learnt the basics of Kafka as a message mediator. We set up a local Kafka environment and learnt how we can use Schema Registry and the Kafka Producer API to send messages to a Kafka topic. We used Kafdrop to inspect the schema and the messages in Kafka.

In the next article we will learn to write the message consumer using the Kafka Consumer API.

Please share your comments and feedback in the comments section or on my Twitter handle [@rahulrai-in](https://twitter.com/rahulrai_in).

## Kafka notes

1. https://itnext.io/how-to-install-kafka-using-docker-a2b7c746cbdc
2. Kafka UI: https://github.com/provectus/kafka-ui
3. Other kafka ui tools: https://dev.to/dariusx/recommend-a-simple-kafka-ui-tool-5gob

// https://dev.to/cloudx/kafka-docker-net-core-101-part-1-b0h

    // https://github.com/confluentinc/confluent-kafka-dotnet/blob/master/examples/AvroSpecific/Program.cs#L84

    // Install avrogen: https://github.com/confluentinc/confluent-kafka-dotnet/blob/master/README.md

    avrogen -s LeaveApplication.avsc . --namespace LMS.Models:LMS.Models

    // How schemas work
    https://kimsereylam.com/kafka/docker/csharp/2020/10/30/kafka-schema-registry-with-avro.html

Blog resources:
https://www.red-gate.com/simple-talk/dotnet/net-development/using-apache-kafka-with-net/

## Launch Kafka UI

docker run -p 8080:8080 -e KAFKA_CLUSTERS_0_NAME=local -e KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092 -d provectuslabs/kafka-ui:latest

{{< subscribe >}}
title Leave Management System Services

Employee->Kafka: Leave application
Kafka->Auto Validator: Leave application
Auto Validator->Kafka: Leave rejected result/Manager approval
Kafka->Manager:Manager approval
Manager->Kafka:Leave rejected result/Leave approved result
