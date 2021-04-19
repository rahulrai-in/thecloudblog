---
title: Event-Driven Architecture with Apache Kafka for .NET Developers Part 1 - Event Producer
date: 2021-03-29
tags:
  - azure
  - integration
  - programming
comment_id: h2ca99aea-1e19-47fa-80ae-8dc567335b16
---

> In this series:
>
> 1. Development environment and Event producer (this article)
> 2. [Event consumer](/post/event-driven-architecture-with-apache-kafka-for-.net-developers-part-2-event-consumer/)
> 3. [Azure Event Hubs integration](/post/event-driven-architecture-with-apache-kafka-for-net-developers-part-3-azure-event-hubs/)

An event-driven architecture utilizes events to trigger and communicate between microservices. An event is a change in the service's state, such as an item being added to the shopping cart. When an event occurs, the service produces an event notification which is a packet of information about the event.

The architecture consists of an event producer, an event router, and an event consumer. The producer sends events to the router, and the consumer receives the events from the router. Depending on the capability, the router can push the events to the consumer or send the events to the consumer on request (poll). The producer and the consumer services are decoupled, which allows them to scale, deploy, and update independently.

[Apache Kafka](https://kafka.apache.org/) is one of the most popular open-source event streaming platforms. It is horizontally scalable, distributed, and fault-tolerant by design. Kafka's programming model is based on the [publish-subscribe pattern](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern). With Kafka, publishers send messages to **topics**, which are named logical channels. A subscriber to a topic receives all the messages published to the topic. In an event-driven architecture, Kafka is used as an event router, and the microservices publish and subscribe to the events.

In this article, we will learn how to prepare the local environment for development and publish messages to Kafka. My subsequent articles will focus on building the components of an end-to-end application that will help you build event-driven microservices.

## Source Code

The complete source code of the application and other artifacts is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/kafka-lms" >}}

## Kafka Components

I will briefly discuss the components of Kafka that are relevant to us for using Kafka as a message broker. Apart from the publish-subscribe model, Kafka also supports a [Streams API](https://kafka.apache.org/documentation/streams/) that is useful for transforming data from one topic to another, and a [Connect API](https://kafka.apache.org/documentation/#connectapi) that helps you implement connectors that pull data from external systems into Kafka or push data from Kafka to external systems. These APIs are outside the scope of this article. To understand Kafka's architecture in detail, please read the [Introduction to Kafka article](https://docs.confluent.io/platform/current/kafka/introduction.html) on the Confluent docs website.

We understand that Kafka acts as a middleman that enables exchanging information from producers to consumers. Kafka can be set up across multiple servers, which are called Kafka brokers. With multiple brokers, you get the benefit of data replication, fault tolerance, and high availability of your Kafka cluster.

Following is a high-level system design of a Kafka cluster:

{{< img src="1.png" alt="Kafka cluster" >}}

The metadata of Kafka cluster processes is stored in an independent system called [Apache Zookeeper](https://zookeeper.apache.org/). Zookeeper helps Kafka perform several critical functions, such as electing a leader in case of node failure. It also maintains the list of consumers in a consumer group and manages the access control list of Kafka topics.

The first level segregation of events/messages in Kafka occurs through a Kafka object called the **topic**. The event producer publishes events to a topic which Kafka can subsequently broadcast to interested consumers. Think of a topic as a collection of FIFO (First In First Out) queues. You can either randomly store a message in one of the queues or place related messages on a single queue to guarantee FIFO. Each of the queues within a topic is called a **topic partition**. Each message in a queue is placed at a unique position number called an **offset**.

{{< img src="2.png" alt="Partitions and offsets" >}}

You can combine multiple consumers in a **consumer group** to scale out the consumption of messages from a topic. A consumer group is identified through a unique group id. Kafka balances the allocation of partitions between individual consumers of a consumer group to avoid the duplicate processing of messages.

After a consumer consumes a message stored at an offset, it commits the message to inform Kafka that it is done processing it. On the subsequent request, the consumer will receive the message at the next offset and so on.

## Local Environment Setup

Setting up a development environment to work with Kafka is reasonably easy with [Docker Compose](https://docs.docker.com/compose/). You can share Docker Compose specifications with other developers in your team to ensure environment consistency. We will use Docker Compose to set up a Kafka cluster that consists of the following components:

1. **Apache Zookeeper**: The Zookeeper dependency will be [removed from Kafka](https://www.confluent.io/blog/removing-zookeeper-dependency-in-kafka/) in the future by some vendors such as Confluent. Read the latest documentation from the vendor that you intend to use for Kafka.
2. **Kafka**
3. **Kafdrop**: [Kafdrop](https://github.com/obsidiandynamics/kafdrop) is a popular web-based user interface for viewing Kafka topics and browsing consumer groups. It makes your Kafka cluster observable, which helps you diagnose issues and helps you with development.
4. **Schema Registry**: Schema Registry is a service that lives outside of your cluster and allows the developers to manage the message schemas. Kafka supports messages in Avro, JSON, and Protobuf formats, and the Schema Registry supports the storage and retrieval of versioned schemas in all those formats. You can read more about Schema Registry on the [Confluent docs website](https://docs.confluent.io/platform/current/schema-registry/index.html).

Several vendors publish Zookeeper and Kafka Docker images with slight differences in behavior and configuration. I typically use the distributions from [Bitnami](https://bitnami.com/stack/kafka/containers). However, you can also use the distributions from [Confluent](https://github.com/confluentinc/cp-docker-images), [Spotify](https://hub.docker.com/r/spotify/kafka/), and [Wurstmeister](https://github.com/wurstmeister/kafka-docker). Bitnami and Confluent build and test the images nightly, and they are also compatible with each other, so I recommend using them.

Create a file named docker-compose.yml and populate the file with the contents of the following listing:

```yaml
version: "2"

networks:
  kafka-net:
    driver: bridge

services:
  zookeeper-server:
    image: bitnami/zookeeper:latest
    networks:
      - kafka-net
    ports:
      - 2181:2181
    environment:
      - ALLOW_ANONYMOUS_LOGIN=yes
  kafdrop:
    image: obsidiandynamics/kafdrop
    networks:
      - kafka-net
    restart: "no"
    ports:
      - 9000:9000
    environment:
      KAFKA_BROKERCONNECT: PLAINTEXT://kafka-server:29092
      JVM_OPTS: -Xms16M -Xmx48M -Xss180K -XX:-TieredCompilation -XX:+UseStringDeduplication -noverify
      SCHEMAREGISTRY_CONNECT: http://schema-registry:8081
    depends_on:
      - kafka-server
  kafka-server:
    image: bitnami/kafka:latest
    networks:
      - kafka-net
    ports:
      - 9092:9092
    environment:
      - KAFKA_CFG_ZOOKEEPER_CONNECT=zookeeper-server:2181
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka-server:29092,PLAINTEXT_HOST://127.0.0.1:9092
      - KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:29092,PLAINTEXT_HOST://:9092
      - KAFKA_CFG_INTER_BROKER_LISTENER_NAME=PLAINTEXT
      - ALLOW_PLAINTEXT_LISTENER=yes
    depends_on:
      - zookeeper-server
  schema-registry:
    image: confluentinc/cp-schema-registry:latest
    networks:
      - kafka-net
    ports:
      - 8081:8081
    environment:
      - SCHEMA_REGISTRY_KAFKASTORE_BOOTSTRAP_SERVERS=PLAINTEXT://kafka-server:29092
      - SCHEMA_REGISTRY_HOST_NAME=localhost
      - SCHEMA_REGISTRY_LISTENERS=http://0.0.0.0:8081
    depends_on:
      - kafka-server
```

We created the services that we previously discussed within the same network for discoverability. The environment variable setting values of the services are set with their recommended values, so modify them with caution.

From your terminal, change to the directory where you stored this file and run the following command to start the services:

```shell
docker-compose up -d
```

After some time, execute the following command to verify whether the services are healthy.

```shell
docker-compose ps
```

The following screenshot presents the output of the command:

{{< img src="3.png" alt="View state of Docker Compose services" >}}

Our monitoring utility, Kafdrop, is now available at [http://localhost:9000](http://localhost:9000).

{{< img src="4.png" alt="Kafdrop UI" >}}

You can only view the two special topics at this time: the `__consumer_offsets` topic that records the offsets processed by the consumers and the `_schemas` topic that the Schema Registry uses to store the versioned schemas of messages. You will see more topics here when we create them programmatically.

## Demo Application: TimeOff

To explore how we can use Kafka to build event-driven applications, we will build a very simple employee leave management system. Our application consists of the following services:

1. **Employee service**: An employee can use this service to submit a leave application. This service submits the **leave application received** event to the **leave-applications** Kafka topic.
2. **Manager service**: This service consumes the events from the **leave-applications** topic and records the manager's input. The application's result is sent as an event named **leave application processed** to the **leave-applications-results** Kafka topic.
3. **Result reader service**: This service displays the approved or unapproved leave applications by consuming the messages from the **leave-applications-results** Kafka topic.

Following is the sequence diagram of the interaction between the services:

{{< img src="5.png" alt="TimeOff sequence diagram" >}}

## Producer Example: Employee Service

Use Visual Studio or VS Code to create a new .NET Core console application and name it **TimeOff.Employee**. For reference, you can locate this project in the [GitHub repository](https://github.com/rahulrai-in/kafka-lms) with the same name. Please note that the code documented in this article might differ slightly from the code in the repository because I have enabled the reuse of code through common functions and shared models. However, the code in the repository is still not refactored to a high degree so that it is easy to comprehend and does not require much navigation.

Before we proceed, I want to discuss the message formats available in Kafka briefly. Kafka supports Avro, Protobuf, and JSON formatted messages. These message formats are supported by the Schema Registry as well. Avro is a preferred format over others if all the services in the ecosystem can support it. You can read about why Avro is the better data serialization format for stream data on the [Confluent website](https://www.confluent.io/blog/avro-kafka-data/).

To enable our application to work with Kafka, you need the [Kafka .NET Client](https://docs.confluent.io/clients-confluent-kafka-dotnet/current/overview.html). Also, since we will use the [Confluent Schema Registry](https://github.com/confluentinc/confluent-kafka-dotnet#working-with-apache-avro) to enforce contracts between the producer and consumer, we need the serializer (for the producer) and deserializer (for the consumer) for our applications. We will use Avro formatted messages in our application, and so we will install the Avro serializer in our project. Use the following commands to install the required NuGet packages in your project:

```powershell
Install-Package Confluent.Kafka
Install-Package Confluent.SchemaRegistry.Serdes.Avro
```

Open the **Program** class file in your editor and begin populating the `Main` method as per the directions. Let's start with initializing an Admin client (`IAdminClient`) to create a topic, a Producer client (`IProducer`) to publish messages to Kafka, and the Schema Registry client (`CachedSchemaRegistryClient`) to enforce schema constraints on the producer.

Each client requires certain initialization parameters, such as the Bootstrap servers, which is the list of brokers that the client will connect to initially. After the initial connection, the client discovers the rest of the brokers automatically. The schema registry requires the address of the Schema Registry server. Use the following code to create the configurations that will be used to initialize the clients.

```c#
var adminConfig = new AdminClientConfig { BootstrapServers = "127.0.0.1:9092" };
var schemaRegistryConfig = new SchemaRegistryConfig { Url = "http://127.0.0.1:8081" };
var producerConfig = new ProducerConfig
{
    BootstrapServers = "127.0.0.1:9092",
    // Guarantees delivery of message to topic.
    EnableDeliveryReports = true,
    ClientId = Dns.GetHostName()
};
```

Please visit the Confluent docs website to read more about the supported [Admin client configurations](https://docs.confluent.io/platform/current/installation/configuration/admin-configs.html), [Producer configurations](https://docs.confluent.io/platform/current/installation/configuration/producer-configs.html), and [Schema registry configurations](https://docs.confluent.io/platform/current/schema-registry/installation/config.html).

Let's first create the topic that will receive our messages. Add the following code to your program to create a new topic named **leave-applications** with three partitions.

```c#
using var adminClient = new AdminClientBuilder(adminConfig).Build();
try
{
    await adminClient.CreateTopicsAsync(new[]
    {
        new TopicSpecification
        {
            Name = "leave-applications",
            ReplicationFactor = 1,
            NumPartitions = 3
        }
    });
}
catch (CreateTopicsException e) when (e.Results.Select(r => r.Error.Code)
    .Any(el => el == ErrorCode.TopicAlreadyExists))
{
    Console.WriteLine($"Topic {e.Results[0].Topic} already exists");
}
```

You must be wondering why we created three partitions? We want to explore how the producer can write to different partitions of a topic. An employee belongs to a department, so we will create a partition for each department in the **leave-applications** topic. Employee applications will be queued sequentially within each department. Let's create an enumeration named `Department` now, which we will later use in the producer's logic.

```c#
public enum Departments : byte
{
    HR = 0,
    IT = 1,
    OPS = 2
}
```

We are now ready to write to our topic. But before we do that, we need to specify the schema of the message that we will write to our topic.

## Avro Schema and Avrogen

Create an Avro schema file named **LeaveApplicationReceived.avsc** in a class library project named **TimeOff.Models** so that we can share it between the producer and the consumer. Add the following schema specification to the file:

```json
{
  "namespace": "TimeOff.Models",
  "type": "record",
  "name": "LeaveApplicationReceived",
  "fields": [
    {
      "name": "EmpEmail",
      "type": "string"
    },
    {
      "name": "EmpDepartment",
      "type": "string"
    },
    {
      "name": "LeaveDurationInHours",
      "type": "int"
    },
    {
      "name": "LeaveStartDateTicks",
      "type": "long"
    }
  ]
}
```

We will convert the Avro schema to a C# class file so that it is understood by our .NET Core Avro serializers and deserializers. We will use the **avrogen** tool [from Confluent](https://github.com/confluentinc/confluent-kafka-dotnet/blob/master/README.md) to automatically generate the C# class file from our Avro specification.

To install the **avrogen** tool, execute the following command:

```shell
dotnet tool install --global Apache.Avro.Tools
```

Next, in your terminal, change to the directory containing the **LeaveApplicationReceived.avsc** file and execute the following command to generate the C# file.

```shell
avrogen -s LeaveApplicationReceived.avsc . --namespace TimeOff.Models:TimeOff.Models
```

Copy the generated file **LeaveApplicationReceived.cs** from the output folder and paste it at the root of the project.

## Message Producer

Let's go back to the `Program` class and continue editing the `Main` method to write the message producer logic as follows:

```c#
using var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);
using var producer = new ProducerBuilder<string, LeaveApplicationReceived>(producerConfig)
    .SetKeySerializer(new AvroSerializer<string>(schemaRegistry))
    .SetValueSerializer(new AvroSerializer<LeaveApplicationReceived>(schemaRegistry))
    .Build();
while (true)
{
    var empEmail = ReadLine.Read("Enter your employee Email (e.g. none@example-company.com): ",
        "none@example.com").ToLowerInvariant();
    var empDepartment = ReadLine.Read("Enter your department code (HR, IT, OPS): ").ToUpperInvariant();
    var leaveDurationInHours =
        int.Parse(ReadLine.Read("Enter number of hours of leave requested (e.g. 8): ", "8"));
    var leaveStartDate = DateTime.ParseExact(ReadLine.Read("Enter vacation start date (dd-mm-yy): ",
        $"{DateTime.Today:dd-MM-yy}"), "dd-mm-yy", CultureInfo.InvariantCulture);

    var leaveApplication = new LeaveApplicationReceived
    {
        EmpDepartment = empDepartment,
        EmpEmail = empEmail,
        LeaveDurationInHours = leaveDurationInHours,
        LeaveStartDateTicks = leaveStartDate.Ticks
    };
    var partition = new TopicPartition(
        ApplicationConstants.LeaveApplicationsTopicName,
        new Partition((int) Enum.Parse<Departments>(empDepartment)));
    var result = await producer.ProduceAsync(partition,
        new Message<string, LeaveApplicationReceived>
        {
            Key = $"{empEmail}-{DateTime.UtcNow.Ticks}",
            Value = leaveApplication
        });
    Console.WriteLine(
        $"\nMsg: Your leave request is queued at offset {result.Offset.Value} in the Topic {result.Topic}:{result.Partition.Value}\n\n");
}
```

> [Readline](https://github.com/tonerdo/readline) is a simple .NET library that offers a rich keyboard input experience to the users of a console application.

Let's navigate through the code together. We created an instance of the `CachedSchemaRegistryClient` class, which allows us to access the schema registry. Kafka exposes the message producer capabilities through the `IProducer` interface. We embedded the Avro key and value serializers into the `IProducer` instance. The Avro serializers use the schema registry client to register a new schema, and they record the schema id with the message sent to Kafka topic.

The `CachedSchemaRegistryClient` maintains a local cache of schemas for validation to minimize the number of calls to the Schema Registry. The `ProduceAsync` method accepts the partition index and the message to send the message to the relevant partition of the topic.

Let's execute the application now to record a few leave applications as follows:

{{< img src="6.png" alt="Employee service output" >}}

Let's use Kafdrop to view the newly registered schema.

{{< img src="7.png" alt="Inspect registered schemas" >}}

Let's also view the newly added messages with Kafkdrop.

{{< img src="8.png" alt="Inspect received messages" >}}

## Conclusion

In this article, we learned the basics of Kafka as a message mediator. We set up a local Kafka environment and learned how to use Schema Registry and the Kafka Producer API to send messages to a Kafka topic. We used Kafdrop to inspect the schema and the messages in Kafka.

In the following article, we will learn to write a message consumer using the Kafka Consumer API.

Please share your comments and feedback in the comments section or on my Twitter handle [@rahulrai_in](https://twitter.com/rahulrai_in).

{{< subscribe >}}
