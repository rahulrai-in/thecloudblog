---
title: Versatile Events in Event Driven Architecture
date: 2021-08-12
tags:
  - azure
  - architecture
comment_id: 860bb4a5-61f2-4a57-a201-e4a3cb4199d9
---

Simple applications rely on synchronous request-response protocols. It is one of the most common patterns we encounter every day in applications and websites where you press a button and expect a response.

As the number of services increases, the number of synchronous interactions between them increases as well. In such a situation, the downtime of a single system also affects the availability of other systems.

{{< img src="1.png" alt="Synchronous interaction channels between services" >}}

Google defines [a set of principles and practices](https://queue.acm.org/detail.cfm?id=3096459) for attaining a high Service Level Agreement (SLA) by increasing the SLA of individual services. However, a more straightforward approach to decouple synchronous systems is to switch to the event-driven architecture. An event-driven architecture comprises highly decoupled, single-purpose event processing components that asynchronously receive and process events.

Events are the cornerstone of an event-driven architecture. There are three constructs that services can use to interact over a network: commands, events, and queries.

### Commands

Commands are requests issued by service to another service to perform an operation or change the system's state. Commands execute synchronously and may include a result that indicates their completion.

An example of a command is `chargeCreditCard()`, which returns whether the payment succeeded. Commands are used in operations that must complete synchronously and should be used within a [bounded context](https://martinfowler.com/bliki/BoundedContext.html).

### Queries

Queries are requests to read data from the data store. They do not affect the state of the system and always return a response.

An example of a query is `fetchProduct(productId=12)` which returns an order [Data Transfer Object (DTO)](https://ardalis.com/dto-or-poco/) containing order details. A DTO contains only the requested information and does not encapsulate any domain knowledge.

### Events

An event can denote a fact or a notification of something that happened in the domain but does not expect a response. Events travel in one direction: from the source to the destination.

An example of an event is `OrderCreated` which contains either the details of the order items or a pointer such as Order ID, which can be used by a service to fetch the order details. Events are used when the loose coupling between services is important or data needs to be replicated between applications.

Unlike commands and queries, events are asynchronous, leading to less coupling between services than the other two. Loosely coupled services can be developed, updated, deployed, and scaled independently of each other as they have few dependencies.

Events are not a substitute for commands and queries, as all three have independent roles to play in a service. Commands change the state of a service, the events notify other services of the change, and the queries serve the updated state to other services.

{{< img src="2.png" alt="Commands, Queries, and Events in a service" >}}

Apart from usual event data formats: JSON and XML, brokers such as Kafka support binary formats such as Avro and Protobuf for high-performance scenarios.

To ensure that schema change is efficiently managed and communicated, you can use a schema registry. A schema registry is an independent service that is used to version the schema. Consumers can fetch schema from the registry on-demand to interpret the events it receives.

## Message Brokers

We require an intermediate system known as a message broker for transporting events to services interested in the events. A message broker is responsible for consuming, storing, and delivering events to their consumers. A message broker should be highly reliable, scalable, and most importantly, ensure that it does not lose events on system failures.

[Apache Kafka](https://kafka.apache.org/) is one of the most popular durable Open Source message brokers that enables applications to process, persist, and re-process events or streams of data. [Azure Service Bus](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-messaging-overview) and [Event Hubs](https://docs.microsoft.com/en-au/azure/event-hubs/) are other popular options. Azure Event Hubs [support Kafka producer and consumer APIs](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-for-kafka-ecosystem-overview) and can be used for event streaming and event analytics.

{{< img src="3.png" alt="Kafka as a broker for transporting events" >}}

There are two categories of message brokers based on how they store data as follows:

1. **Store-backed**: These brokers store events in a data store to serve the consumers. They purge the events from their store after delivering them to consumers. RabbitMQ, Apache ActiveMQ, and Azure Service Bus queues are examples of store-backed brokers.
2. **Log-based**: These brokers store events in commit logs. The brokers persist the events even after their consumption. Since the events are not removed, the brokers allow consumers to replay events from a previous point in time. NATS, Apache Kafka, and Azure Event Hubs are examples of Log-based brokers.

Both the store-backed and log-based brokers provide guarantees of event delivery. Let's discuss the event delivery guarantees of the brokers next.

## Event Delivery Guarantees

There are three models a message broker supports to deliver events to a consumer. In Kafka, these models are driven by the consumers. Other message brokers such as WebSphere MQ follow a different approach for ensuring assured delivery of events. Azure Service Bus requires a collaboration between the broker and the consumer to ensure delivery.

- **At least once**: The event is guaranteed to be delivered to the consumer. However, in cases such as nonreceipt of delivery acknowledgment by message broker, the consumer might receive the message again.
- **At most once**: The event is delivered to the consumer only once or not at all. The message broker won't deliver the same event again. With log-based brokers, the consumer needs to remember the offset of the lost message to receive it again.
- **Exactly once**: Stream processing applications read data from the broker, process it, and write new events/stream data to the broker. Brokers such as Kafka support the consumption and production of events in an atomic transaction such that every message is consumed and then published exactly once. Read [Kafka Transaction API KIP](https://cwiki.apache.org/confluence/display/KAFKA/KIP-447%3A+Producer+scalability+for+exactly+once+semantics) to understand how Kafka implements this model. Azure Service Bus supports exactly-once delivery through [duplicate message detection](https://docs.microsoft.com/en-us/azure/service-bus-messaging/duplicate-detection).

Now that we understand the role of message brokers, let's direct our discussion back to the events and discuss the standard use of events in a system.

## Using Events to Notify State Change

Brokers such as Kafka and Azure Service Bus support the publish-subscribe model, with the consumers defining the routing of messages to them. Since the routing is consumer driven, any consumer can plug themselves into the brokers to receive the events they are interested in without affecting other services. Azure Service Bus supports filtering of messages in the broker, whereas, in Kafka, the consumers must filter the messages they receive.

In an event-driven architecture, services do not know about the existence of other services. A service is only interested in specific state changes notified through events and reacts to the change. Let's try to understand this concept with an example. Say we have the following two services in our e-commerce application:

1. **Orders service**: To accept orders from the customers.
2. **Shipping service**: To ship the orders received.

{{< img src="4.png" alt="Orders service and shipping service" >}}

When a customer places an order, the orders service updates its state and publishes the order received event to the message broker. The shipping service fetches the event and updates its state. Due to loose coupling between the services, we can extend the feature set of our application without modifying the existing services.

We now want to add a pricing service to the application that updates the product's price based on its demand. We can plug the new service as a consumer of the order received event without affecting the other services.

{{< img src="5.png" alt="Plugging a new service without disrupting existing services" >}}

## Using Events to Replicate State

In the previous example, we used events to notify services of state changes. However, if the shipping service requires customer details, it will still need to query the customer service synchronously. You can discern that this query can break the loose coupling between the services. We can fix this problem with events.

We can use events to replicate the state from the customer service so that the shipping service can use its local state to read customer details.

{{< img src="6.png" alt="Replicating state with events" >}}

In this scenario, we are using events for data integration. This pattern is formally termed [event-carried state transfer](https://martinfowler.com/articles/201701-event-driven.html). You do not need to choose between one of the two use cases of events. You can use events for notification of state changes to make the architecture pluggable and for data replication to enable local query execution.

A pure query by event-carried state transfer gives your solution better isolation, faster data access, and the ability to run the application offline. On the other hand, synchronous query operations with REST/RPC make your solution simple, act as the single source of truth, and centralize the management. Based on the level of complexity you desire, you can use either or a mix of both approaches.

## Event Collaboration Pattern

Martin Fowler introduced a pattern called [Event Collaboration](https://martinfowler.com/eaaDev/EventCollaboration.html) which enables a set of services to collaborate on a single business workflow. Each service does its bit in the workflow in this architecture by listening to the events and creating new ones. The events are processed in an orchestrated manner by the services to complete an operation. For example, in an e-commerce application, the order service captures order details and raises order placed events. Next, the order placed event is processed by the payment service, which raises the order confirmed event. The events keep triggering services and cause the subsequent events in the chain to be produced, thus completing the workflow.

In the following diagram, the events are denoted by circles, and the directions of the arrow connecting the events and services indicate the service the creates and consumes the event. The color of the circle designates the topic the event is in. The connections between the events denote the workflow in terms of events.

{{< img src="7.png" alt="Event collaboration pattern in an e-commerce application" >}}

As you can see, no single service owns the process, and each service owns a subset of event transitions. The services only understand the event they require and the event they produce. Due to the loose coupling, you can replace existing services or update services to raise more events without affecting the workflow as long as you maintain the events produced in the workflow.

## Hybrid Request-Response and Event-Driven Architectures

In large organizations, you are more likely to find that the overarching architecture is a mix of request-response and event-driven architecture within a bounded context (in general, a department). However, for the communication between bounded contexts, a central message broker is used.

{{< img src="8.png" alt="Use of hybrid architecture in a domain and EDA across domains" >}}

One key [Domain-driven design (DDD)](https://en.wikipedia.org/wiki/Domain-driven_design) theory is that widespread code, functionality, and data reuse are counterproductive. The hybrid architecture approach promotes reuse within a bounded context while avoiding it across all bounded contexts. Within a bounded context, the domain model is shared, and between bounded contexts, the communication is through more restricted interfaces or events, both of which have well-defined contracts.

## Summary

In this article, we learned that events have two separate roles: notify other services of an action and send data to other services. Events make your architecture pluggable and allow your application to add new features without affecting existing services.

It is sensible to combine request-response and event-driven architectures based on the level of cohesiveness desired. We discussed the Event Collaboration pattern that enables the communication between different bounded contexts only through events. Finally, we discussed a practical architecture that is event-driven across the bounded contexts of an organization but follows a hybrid approach within a bounded context. You are more likely to encounter this architecture, and it will evolve as the organization adds new departments or merges existing departments.

{{< subscribe >}}
