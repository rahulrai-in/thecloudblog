---
title: Building Resilient Kafka Producers in .NET with Polly
date: 2021-06-15
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Sending messages reliably and quickly between services is a core requirement for most distributed systems. Apache Kafka is a popular durable message broker that enables applications to process, persist and re-process streamed data with low latency, high throughput and fault tolerance. To learn more about Apache Kafka architecture, please refer to the articles in my [Apache Kafka series](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/).

One of my Twitter friends among others reached out to me to explain how to implement retries in Kafka. I am always looking out for topics that I can explore and guide my audience and [Twitter](https://twitter.com/intent/user?screen_name=rahulrai_in) is a great medium to interact with me (cue to follow 😉).

{{< tweet 1402985115622330374 >}}

In the following sections, we will look at key configurations and implementations of the producer and consumer that help build reliable applications with Kafka. Let's first discuss the reliable consumer patterns.

## Reliable Consumers

There are three models in which Kafka can deliver messages to a consumer:

- **At least once**: This is the default processing model of Kafka. In this model, a consumer commits the offsets after processing the batch of messages it receives from Kafka. In case of an error, the consumer will receive the messages again and hence the consumer needs to be idempotent.
- **At most once**: In this model, the consumer commits the offsets right after receiving a batch of messages. If during processing, the consumer encounters an error, the messages will be lost.
- **Exactly once**:

## Reliable Producers

https://docs.confluent.io/platform/current/installation/configuration/producer-configs.html

https://stackoverflow.com/questions/42564920/kafka-producer-config-retry-strategy

https://www.linkedin.com/pulse/all-kafka-reliability-gaurav-chopra/?trk=public_profile_article_view

https://eng.uber.com/reliable-reprocessing/

https://medium.com/kinandcartacreated/building-reliable-applications-with-kafka-283c3563d34e

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}

https://medium.com/kinandcartacreated/building-reliable-applications-with-kafka-283c3563d34e
