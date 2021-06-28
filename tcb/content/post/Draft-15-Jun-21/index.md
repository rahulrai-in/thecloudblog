---
title: Building Reliable Kafka Producers in .NET
date: 2021-06-15
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Sending messages reliably and quickly between services is a core requirement for most distributed systems. Apache Kafka is a popular durable message broker that enables applications to process, persist and re-process streamed data with low latency, high throughput and fault tolerance. To learn more about Apache Kafka architecture, please refer to the articles in my [Apache Kafka series](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/).

One of my Twitter friends among others reached out to me to explain how to implement retries in Kafka. I am always looking out for topics that I can explore and guide my audience and [Twitter](https://twitter.com/intent/user?screen_name=rahulrai_in) is a great medium to interact with me (cue to follow 😉).

{{< tweet 1402985115622330374 >}}

In the following sections, we will look at key configurations and implementations of the producer and consumer that help build reliable applications with Kafka. Let's first discuss the requirements for building a reliable consumer application.

## Reliable Consumers

There are three models in which Kafka can deliver messages to a consumer:

- **At least once**: This is the default processing model of Kafka. In this model, a consumer commits the offsets after processing the batch of messages it receives from Kafka. In case of an error, the consumer will receive the messages again and hence the consumer needs to be idempotent.
- **At most once**: In this model, the consumer commits the offsets right after receiving a batch of messages. If during processing, the consumer encounters an error, the messages will be lost.
- **Exactly once**: Stream processing applications read data from a Kafka topic, process it, and writes data to another topic. In such applications, we can use the Kafka transaction API to ensure that a message is considered consumed only if it is successfully written to the destination topic. I will discuss transactions in a separate article.

Irrespective of the delivery model you use, you should design consumer applications to be idempotent for high reliability. To understand why a consumer might receive the same message multiple times, let's study the workflow followed by a basic consumer:

1. Pull a message from Kafka topic.
2. Process the message.
3. Commit the message to the Kafka broker.

The following issues may arise during the execution:

- **Scenario 1**: Consumer crashes before committing the offset. When the consumer restarts, it will receive the same message from the topic.
- **Scenario 2**: Consumer sent the request to commit the offsets and failed before it received a response. Upon restart the consumer will be in indeterminate state because it doesn't know whether it successfully committed the offsets. To resolve its state, it fetches the messages from the old offset.

For exactly once processing, the Kafka producer [must be idempotent](https://hevodata.com/blog/kafka-exactly-once-semantics/) and consumer should only read committed messages (by setting isolation level to `read_committed`) of a transaction and not messages from a transaction that have not yet been committed. However, there are caveats to exactly once processing in both producer and consumer applications. Idempotence in the producer application can't guarantee that the producer can not queue duplicate messages. Also, if the processing of a message involves external services, such as database, and services, we must ensure that they can gurantee exactly once processing as well. The exactly once processing requires coopoeration between producers and consumers which might be hard in a large distributed application. 

To process messages reliably with as few duplicate message processing as possible, you should commit the offsets of consumed mesages yourself.  I discussed how you can build a consumer 

Let's now discuss the steps to implement a reliable Kafka producer application.

## Reliable Producers

The following producer settings are important for high data integrity. You can read more about the settings in the [producer configuration section of the Confluent SDK documentation](https://docs.confluent.io/platform/current/installation/configuration/producer-configs.html):

1. `Acks`: This field determines the number os acknowledgements that the leader broker should receive from in sync replicas before responding to the client. Setting it to `All` makes the leader block until message is committed by all in sync replicas. It is the safest option and provides highest reliability.
2. `MessageSendMaxRetries`: The value of the setting determines the number of times to retry sending a failing message.
3. `RetryBackoffMs`: Backoff time in milliseconds before retrying an operation.
4. `EnableIdempotence`: Setting the value of this property to `true` ensures that the producer does not produce duplicate messages and are delivered in order within the partition.

https://docs.confluent.io/platform/current/installation/configuration/producer-configs.html

https://stackoverflow.com/questions/42564920/kafka-producer-config-retry-strategy

https://www.linkedin.com/pulse/all-kafka-reliability-gaurav-chopra/?trk=public_profile_article_view

https://eng.uber.com/reliable-reprocessing/

https://medium.com/kinandcartacreated/building-reliable-applications-with-kafka-283c3563d34e

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}

https://medium.com/kinandcartacreated/building-reliable-applications-with-kafka-283c3563d34e
