---
title: Building Reliable Kafka Producers and Consumers in .NET
date: 2021-06-30
tags:
  - integration
  - programming
comment_id: 1aabc487-a902-4995-bebf-c3f16c6ca41f
---

Sending messages reliably and quickly between services is a core requirement for most distributed systems. Apache Kafka is a popular, durable message broker that enables applications to process, persist and re-process streamed data with low latency, high throughput, and fault tolerance. If you are a beginner in Kafka, please consider reading the articles in my [Apache Kafka series](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/) to get up to speed in no time.

One of my Twitter friends, among others, reached out to me to understand how to implement retries in Kafka. I am always searching for topics to explore and guide my audience, and [Twitter](https://twitter.com/intent/user?screen_name=rahulrai_in) is a great medium to interact with me (cue to join me on Twitter 🐤).

{{< tweet 1402985115622330374 >}}

In the following sections, we will look at key configurations and implementations of the producer and consumer that help build reliable applications with Kafka. Let’s first discuss the requirements for building a reliable consumer application.

## Reliable Consumers

There are three models in which Kafka can deliver messages to a consumer:

- **At least once**: This is the default processing model of Kafka. In this model, a consumer commits the offsets after processing the batch of messages it receives from Kafka. In case of an error, the consumer will receive the messages again, and hence it needs to be idempotent.
- **At most once**: In this model, the consumer commits the offsets right after receiving a batch of messages. If, during processing, the consumer encounters an error, the messages will be lost.
- **Exactly once**: Stream processing applications read data from a Kafka topic, process it, and writes data to another topic. In such applications, we can use the [Kafka transaction API](https://www.confluent.io/blog/transactions-apache-kafka/) to ensure that a message is considered consumed only if it is successfully written to the destination topic.

Irrespective of the delivery model you use, you should design consumer applications to be idempotent for high reliability. To understand why a consumer might receive the same message multiple times, let's study the workflow followed by a basic consumer:

1. Pull a message from a Kafka topic.
2. Process the message.
3. Commit the message to the Kafka broker.

The following issues may occur during the execution of the workflow:

- **Scenario 1**: Consumer crashes before committing the offset. When the consumer restarts, it will receive the same message from the topic.
- **Scenario 2**: Consumer sends the request to commit the offsets but crashes before it receives a response. Upon restart, the consumer will be indeterminate because it doesn't know whether it successfully committed the offsets. To resolve its state, it will fetch the messages from the old offset.

For exactly-once processing, the Kafka producer [must be idempotent](https://hevodata.com/blog/kafka-exactly-once-semantics/). Also, the consumer should only read committed messages (by setting isolation level to `read_committed`) of a transaction and not the messages from a transaction that has not yet been committed. However, there are caveats to exactly-once processing in both the producer and the consumer applications. Idempotence in the producer application can't guarantee that the producer can not produce and queue duplicate messages. Also, if the processing of a message involves external services, such as databases, and services, we must ensure that they can also guarantee exactly-once processing. The exactly-once processing requires cooperation between producers and consumers, which might be hard to achieve in a large distributed application.

For reliable processing of events by a consumer, the following three configurations are important:

1. `group.id`: If multiple consumers have the same group ID, Kafka will allocate a subset of partitions to each consumer, and so they will receive a subset of messages. To read all messages from a topic, the consumer should have a unique group ID.
2. `auto.offset.reset`: This parameter controls the offset from which the consumer will start receiving messages when the consumer first starts or when the consumer asks for offsets that don’t exist in the broker. If you set the value to `earliest`, the consumer will start reading messages from the beginning of the partition. If you set the value to `latest`, the consumer will start reading messages from the end of the partition.
3. `enable.auto.commit`: For reliable processing of messages, with as few reprocessing of duplicate messages as possible, you should commit the offsets manually in your code. You can inspect the implementation of a reliable consumer in my [previous article on Kafka Event Consumers](/post/event-driven-architecture-with-apache-kafka-for-.net-developers-part-2-event-consumer/). If you choose to commit offsets manually, it will negate the setting `auto.commit.interval.ms`, which controls how often the messages are automatically committed. For automatic commits, keeping the value of this setting low ensures that you will not receive many duplicate messages when a consumer abruptly stops.

Let's now discuss the steps to implement a reliable Kafka producer application.

## Reliable Producers

Assuming that the brokers are configured with the most reliable configuration possible, we must ensure that the producers are configured to be reliable as well.

The following producer settings are necessary to ensure that our producer doesn't accidentally lose messages. You can read more about the individual settings in detail in the [producer configuration section of the Confluent SDK documentation](https://docs.confluent.io/platform/current/installation/configuration/producer-configs.html):

1. `acks`: This field determines the number of acknowledgments that the leader broker should receive from in-sync replicas before responding to the client. Setting it to `all` makes the leader broker block the request until all in-sync replicas commit the message. It is the safest option and provides the highest reliability.
2. `message.send.max.retries`: The value of this setting determines the number of times to retry sending a failing message.
3. `retry.backoff.ms`: Backoff time in milliseconds before retrying an operation.
4. `enable.idempotence`: Setting the value of this property to true ensures that the producer does not produce duplicate messages and the messages are delivered in order within the partition.

Following are the two types of errors (as response error codes) that the broker will return to producers:

1. **Retriable errors**: These are transient errors such as `LEADER_NOT_AVAILABLE`, which the producer will attempt to recover from automatically. After the producer exhausts the interval specified in the `message.timeout.ms` setting (default 300000), the producer will throw an exception that needs to be handled in the code.
2. **Permanent errors**: Errors such as `INVALID_CONFIG` can not be resolved with retries. The producer will receive an exception from the broker that needs to be handled in the code.

Remember that retries might lead to writing duplicate messages to the broker. Therefore, it is a reasonable design consideration to add a unique identifier to the messages, which will help the consumers detect duplicates and clean them before processing a message. If the consumer is idempotent, then processing duplicate messages will have no impact on the correctness of the application's state.

An excellent approach to managing errors in the producer application is to leverage the producer's retry mechanism, handle the exceptions, store the message in searchable logs or databases, and raise alerts for manual intervention.

## Source Code

Please download the source code of the sample application from the following GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/kafka-retry-pattern" >}}

The sample application contains a reliable producer implementation and a simple consumer that you can use to build your applications.

## Building a Reliable Producer

Create a new .NET Core console application and add a class named `Producer` to it. Install the **Confluent.Kafka** NuGet package to the application.

```powershell
Install-Package Confluent.Kafka
```

Let's instantiate a `ProducerConfig` object with the settings required to build a reliable producer.

```c#
public Producer(string bootstrapServer)
{
    _producerConfig = new ProducerConfig
    {
        BootstrapServers = bootstrapServer,
        EnableDeliveryReports = true,
        ClientId = Dns.GetHostName(),
        // Emit debug logs for message writer process, remove this setting in production
        Debug = "msg",

        // retry settings:
        // Receive acknowledgement from all sync replicas
        Acks = Acks.All,
        // Number of times to retry before giving up
        MessageSendMaxRetries = 3,
        // Duration to retry before next attempt
        RetryBackoffMs = 1000,
        // Set to true if you don't want to reorder messages on retry
        EnableIdempotence = true
    };
}
```

Create a function named `StartSendingMessages` that will write alphabets from A to Z as messages to the broker. Let's begin with building a producer that writes logs and errors (transient and permanent) in the desired format. You can also use the custom handlers to write the logs and errors to your choice of log service, e.g., Splunk.

```c#
public async Task StartSendingMessages(string topicName)
{
    using var producer = new ProducerBuilder<long, string>(_producerConfig)
        .SetKeySerializer(Serializers.Int64)
        .SetValueSerializer(Serializers.Utf8)
        .SetLogHandler((_, message) =>
            Console.WriteLine($"Facility: {message.Facility}-{message.Level} Message: {message.Message}"))
        .SetErrorHandler((_, e) => Console.WriteLine($"Error: {e.Reason}. Is Fatal: {e.IsFatal}"))
        .Build();
    ...
}
```

Let’s start producing some messages and record any issues. I prefer to kill the producer process in case of permanent failures to avoid adding too many errors or failed messages to my log stores.

```c#
try
{
    Console.WriteLine("\nProducer loop started...\n\n");
    for (var character = 'A'; character <= 'Z'; character++)
    {
        var message = $"Character #{character} sent at {DateTime.Now:yyyy-MM-dd_HH:mm:ss}";

        var deliveryReport = await producer.ProduceAsync(topicName,
            new Message<long, string>
            {
                Key = DateTime.UtcNow.Ticks,
                Value = message
            });

        Console.WriteLine($"Message sent (value: '{message}'). Delivery status: {deliveryReport.Status}");
        if (deliveryReport.Status != PersistenceStatus.Persisted)
        {
            // delivery might have failed after retries. This message requires manual processing.
            Console.WriteLine(
                $"ERROR: Message not ack'd by all brokers (value: '{message}'). Delivery status: {deliveryReport.Status}");
        }

        Thread.Sleep(TimeSpan.FromSeconds(2));
    }
}
catch (ProduceException<long, string> e)
{
    Console.WriteLine($"Permanent error: {e.Message} for message (value: '{e.DeliveryResult.Value}')");
    Console.WriteLine("Exiting producer...");
}
```

The Kafka SDK has the smarts to retry on failures, so we don't need to retry failed operations ourselves.

To test the application, we require a simple consumer that consumes the messages that the producer adds to the broker. You can follow my step-by-step instructions to build a consumer application in detail in my [previous article from the Kafka series](/post/event-driven-architecture-with-apache-kafka-for-.net-developers-part-2-event-consumer/).

## Demo

You will find a Docker Compose specification in the GitHub repository, which you can use to set up a local Kafka cluster. You can read the components that make up the specification in my [previous blog post](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/). Alternatively, you create and [use Azure Event Hubs](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-3-azure-event-hubs/) for debugging the application.

Launch two instances of the application and execute the producer in one and the consumer in the other as follows:

{{< img src="1.png" alt="Producer and consumer in action" >}}

You can kill the Kafka container while the producer is still running to simulate an error which will raise an exception. On encountering an exception, you should log the message that you failed to send so that you can resume processing from there easily.

{{< img src="2.png" alt="Producer retries and failure" >}}

## Conclusion

Building a reliable producer and consumer application is very easy with the Kafka SDK. Remember that making your consumer application idempotent will shield your system from falling apart when it receives a duplicate message. Exactly-once message delivery is very much possible in Kafka but requires tight coordination between the producer and consumer. As the producer and consumer applications grow in number and complexity in an organization, this coordination is often not possible. In a reliable system, every component: the broker, the producer, and the consumer must be reliable individually.

{{< subscribe >}}
