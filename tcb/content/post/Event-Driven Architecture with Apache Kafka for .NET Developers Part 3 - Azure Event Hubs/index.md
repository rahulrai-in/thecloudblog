---
title: Event-Driven Architecture with Apache Kafka for .NET Developers Part 3 - Azure Event Hubs
date: 2021-04-04
tags:
  - azure
  - integration
  - programming
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

> In this series:
>
> 1. [Development environment and Event producer](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-1-event-producer/)
> 2. [Event consumer](/post/event-driven-architecture-with-apache-kafka-for-.net-developers-part-2-event-consumer/)
> 3. Azure Event Hubs integration (this article)

The [Azure Event Hub](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-about) is a highly scalable event ingestion service that can be used to build a data streaming platform.

supports the Apache Kafka Producer and Consumer API. You can read in detail about how you can use Azure Event Hub as the messaging backplane for Apache Kafka application on the [Microsoft documentation website](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-for-kafka-ecosystem-overview).

https://github.com/Azure/azure-sdk-for-net/tree/master/sdk/schemaregistry/Microsoft.Azure.Data.SchemaRegistry.ApacheAvro

Deffault Credentials: https://docs.microsoft.com/en-us/dotnet/api/overview/azure/identity-readme

## Conclusion

In this article we learnt to use the Kafka Consumer API to build message consumers. We used the Schema Registry to manage schema of the messages consumed. Finally, we inspected the behavior of Kafka rebalancer and built the Result reader service to complete our application.

We now have a complete event-driven application that uses Kafka as the messaging backplane. I hope that I was able to enrich your knowledge of Kafka and you had fun building this application with me. In the next article we will learn about the changes that we need to make to our application to use Azure Event Hub as the messaging backplane. Azure Event Hubs support Kafka Producer and Consumer APIs, so this process should be easy.

Your feedback is a key component of my writing. Please share your comments and questions in the comments section or on my Twitter handle [@rahulrai_in](https://twitter.com/rahulrai_in).

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
