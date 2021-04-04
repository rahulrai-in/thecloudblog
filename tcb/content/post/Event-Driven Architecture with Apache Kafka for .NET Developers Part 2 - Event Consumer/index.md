---
title: Event-Driven Architecture with Apache Kafka for .NET Developers Part 2 - Event Consumer
date: 2021-04-04
tags:
  - azure
  - integration
  - programming
comment_id: de0dcbee-7c67-4019-8bbb-34cde6265b7c
---

> In this series:
>
> 1. [Development environment and Event producer](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/)
> 2. Event consumer (this article)
> 3. Azure integration (coming soon)

Let's carry our discussion forward and implement a consumer of the events published by the **Employee service** to the **leave-applications** Kafka topic. We will extend the application that we developed earlier to add two new services to demonstrate how Kafka consumers work: **Manager service** and **Result reader service**.

## Source Code

The complete source code of the application and other artifacts is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/kafka-lms" >}}

## Consumer Example: Manager Service

The Manager service acts as both a consumer and a producer of events. The service reads the leave applications from the **leave-applications** topic (consumer), asynchronously records the manager's decision on the application, and publishes the result as an event named **leave application processed** to the **leave-applications-results** Kafka topic (publisher).

Since we previously discussed the Publisher API and its implementation in the Employee service in detail in the previous article, I will not cover its event producer feature again. I encourage you to attempt building the publisher feature of the service using my version of the source code as a guide.

Launch your Visual Studio or VS Code to create a new .NET Core console application named **TimeOff.Manager** in the same solution as the Employee service. For reference, you can locate this project in the [GitHub repository](https://github.com/rahulrai-in/kafka-lms) with the same name.

As before, we will install the following NuGet packages to our project to enable our application to understand how to produce and consume messages:

```powershell
Install-Package Confluent.Kafka
Install-Package Confluent.SchemaRegistry.Serdes.Avro
```

Open the **Program** class file in your editor and begin populating the `Main` method as per the directions. You can access the Kafka consumer API through an instance of the `IConsumer` class. As before, we need the Schema Registry client (`CachedSchemaRegistryClient`) to enforce schema constraints on the consumer.

Like the producer client, the consumer client requires certain initialization parameters, such as the list of Bootstrap servers, the brokers to which the client will initially connect. Use the following code to create the configurations that will be used to initialize the client.

```cs
var schemaRegistryConfig = new SchemaRegistryConfig { Url = "http://127.0.0.1:8081" };
var consumerConfig = new ConsumerConfig
{
    BootstrapServers = "127.0.0.1:9092",
    GroupId = "manager",
    EnableAutoCommit = false,
    EnableAutoOffsetStore = false,
    // Read messages from start if no commit exists.
    AutoOffsetReset = AutoOffsetReset.Earliest,
    MaxPollIntervalMs = 10000
};
```

Let’s discuss the initialization properties and their values in a little more detail. Multiple consumers can be grouped into a consumer group that a `GroupId` uniquely identifies. Kafka will automatically balance the allocation of partitions to consumers belonging to the same consumer group.

As consumers read messages from a partition, they store a pointer to their position in the partition (called offset) within Kafka. Kafka stores this information in a topic named **\_\_consumer_offsets**. If a consumer resumes processing after a delay due to scheduled shutdowns or application crashes, it can resume processing messages from where it left earlier.

The Kafka .NET client can automatically record and store offsets periodically in Kafka. We can turn off the automatic offset persistence process by setting the value of the `EnableAutoCommit` property to false for better control. The automatic offset persistence feature uses an in-memory database to record the offsets. We can safely turn off the database feature by setting the value of the property `EnableAutoOffsetStore` to false.

When you start a consumer, you can configure it to start reading data from the last recorded offset, or in its absence, the beginning of the partition. By default, the consumer receives messages queued to its partitions after the consumer process is started. We do not want to lose messages if our consumer crashes, so we will set the value of property `AutoOffsetReset` to `AutoOffsetReset.Earliest`.

FInally, the `MaxPollIntervalMs` specifies the duration in milliseconds after which you must invoke the `IConsumer.Consume` method. If this interval is exceeded, Kafka will consider the consumer as failed and it will rebalance the partitions to assign the affected partitions to healthy consumers. Since the consumption of messages is time-sensitive, you must record and store the offsets within the time period that you specify. For processes that may require a variable amount of time to process a message, I recommend that you record the message in database and process it asynchronusly, rather than holding the message and waiting for the processing to complete.

Let's continue writing the message consumer logic as follows:

```cs
record KafkaMessage(string Key, int Partition, LeaveApplicationReceived Message);
var leaveApplicationReceivedMessages = new Queue<KafkaMessage>();

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
        Console.WriteLine("Consumer loop started...\n");
        while (true)
        {
            try
            {
                // We will give the process 1 second to commit the message and store its offset.
                var result = consumer.Consume(TimeSpan.FromMilliseconds(consumerConfig.MaxPollIntervalMs - 1000));
                var leaveRequest = result?.Message?.Value;
                if (leaveRequest == null)
                {
                    continue;
                }

                // Adding message to a list just for the demo.
                // You should persist the message in database and process it later.
                leaveApplicationReceivedMessages.Add(new KafkaMessage(result.Message.Key, result.Partition.Value, result.Message.Value));

                consumer.Commit(result);
                consumer.StoreOffset(result);
            }
            catch (ConsumeException e) when (!e.Error.IsFatal)
            {
                Console.WriteLine($"Non fatal error: {e}");
            }
        }
    }
    finally
    {
        consumer.Close();
    }
}
```

Let's discuss the code listing in detail. We created an instance of the `CachedSchemaRegistryClient` class to access the Schema Registry. Next, we created an instance of the class `Consumer`, which implements the `IConsumer` interface. Kafka exposes the message consumer capabilities through the `IConsumer` interface. Since a consumer only needs to understand the mechanics of deserializing the message key and value, we bolted on the Avro key and value deserializers to the `IConsumer` instance.

To link a consumer to a topic, you need to invoke the `Subscribe` method with the topic's name. You can also pass a list of topic names to another overload of the `Subscribe` method if you are interested in simultaneously consuming messages from several topics.

After the `Subscribe` method is invoked, the Kafka .NET client spawns several background threads that prefetch messages from the consumer's topics. You can retrieve those messages one at a time by invoking the `Consume` method. The `Consume` method must be invoked in a loop to receive all the messages that the background threads fetched. In case of failures during processing, the `Close` method will persist any in-memory offsets and instruct Kafka to rebalance the partitions so that the partitions attached to this consumer are allocated to another client.

The `Commit` method commits the offset of the processed message, and the `StoreOffset` method immediately records the offsets in Kafka. Committing and storing the offsets frequently is my preferred approach as it ensures that we won't end up processing several messages again after service disruptions.

Note that the code is a simplified version of the code you will see in the [related GitHub repository](https://github.com/rahulrai-in/kafka-lms). The Manager service requires gathering manager approval for each leave application which might take an indefinite amount of time, and publish the application's outcome to the **leave-applications-results** topic. The process of obtaining the manager's approval and publishing the events must occur in parallel to the consumption of messages which is managed by executing the producer and the consumer tasks in parallel using C# `Task`.

Let's launch this application and verify whether it processes the messages that we published on the topic earlier ([previous article](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/)).

{{< img src="1.png" alt="Manager service consuming messages" >}}

## Partition Rebalancing in Action

We discussed earlier that any change in the number of partitions or consumers in a consumer group leads to Kafka rebalancing partitions' ownership to consumers. To inspect this behavior, let's launch three instances of the Manager service console application.

Next, let's start an instance of the Employee service console application and submit three leave applications, one from each department. You will find that the events land in the Kafka assigned consumer application instances. Note that this behavior is managed internally by Kafka, and hence you might see a different allocation behavior than I do.

{{< img src="2.png" alt="Partition ownership of consumers" >}}

Let's submit three more leave applications from the Employee service. Kafka will ensure that the subsequent messages on a partition reach only the corresponding client.

{{< img src="3.png" alt="Consumer receives subsequent messages from partition" >}}

Try shutting down some Manager service instances and starting new ones to see how Kafka rebalances the partitions' ownership to clients. Additionally, please try creating another consumer group polling events from the same Kafka topic by creating a replica of the Manager service and assigning it a different `GroupId`. You will find that consumer groups are entirely independent of each other, and the change in the topology of one consumer group does not affect another consumer group.

## Result Reader Service

The Result reader service is a simple application that uses the Kafka Consumer API to poll the **leave-applications-results** topic and display the **leave application processed** events on the console. This application is named **TimeOff.ResultReader** in the companion GitHub repository. The following screenshot presents the result of running this application to view the status of the leave applications that we have submitted till now:

{{< img src="4.png" alt="Results of the leave applications" >}}

## Conclusion

In this article, we learned to use the Kafka Consumer API to build message consumers. We used the Schema Registry to manage the schema of the messages consumed. Finally, we inspected how Kafka rebalanced partitions and built the Result reader service to complete our application.

We now have a complete event-driven application that uses Kafka as the messaging backplane. Did you have fun building this application with me? In the next article, we will learn about the changes we need to make to our application to use Azure Event Hub as the messaging backplane. Azure Event Hubs support Kafka Producer and Consumer APIs, so this process should be easy.

Your feedback is a crucial component of my writing. Please share your feedback and questions in the comments section or on my Twitter handle [@rahulrai_in](https://twitter.com/rahulrai_in).

{{< subscribe >}}
