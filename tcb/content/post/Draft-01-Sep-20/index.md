---
title: "Draft 01 Sep 20"
date: 2020-09-01T19:00:33+10:00
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

My team is currently working on building a high performance cloud native project to manage the customer data. We have a set of services and jobs that manage the customer data processing a continuous stream of requests to create, validate, and update customer data. There are two types of systems that we serve from the service. The first category of services need a subset of customer data available to them locally to perform operations. We send domain events to these service (via Kafka topics) to keep their databases in sync. The second category of services are either stateless (e.g. UI that displays customer data), or validates the current state of customer before performing operation (e.g. accounting services to validate whether customer is active).

The customer service is designed with the onion\hexagonal architecture principles. Additionally, the presentation layer of the service is multi faceted to service both REST and GraphQL requests. Now that gRPC is well supported by most of the applications in our ecosystem, we decided to trial gRPC for communication with the new service. The REST contracts exist mostly to maintain backward compatibility and might be replaced with the protocol translation feature when we bring Istio to the fold.

The default implementation of the gRPC on .NET - `Grpc.net` is built on `Grpc.Core` which uses the _protoc_ tool (see: [ProtoCompilerOutput](https://github.com/grpc/grpc/blob/master/src/csharp/Grpc.Tools/ProtoCompilerOutputs.cs)) to generate C# artifacts from supplied _.proto_ files. There are some limitations to using the current implementation of gRPC especially testing the contracts and the complexity it adds to sharing and consuming the contracts by the clients.

Since our current use case requires unary communication a.k.a Request-Response communication. We also want to reuse the existing REST contracts that that follow the CQS ([Command Query Separation](https://martinfowler.com/bliki/CommandQuerySeparation.html)) pattern without creating additional components that manage trnaslation and use our existing contract tests infrastructure built with [Pact](https://docs.pact.io/) for testing our contracts. This led us to zero down on [protobuf-net.Grpc](https://protobuf-net.github.io/) that checked all the boxes for us. The `protobuf-net.Grpc` library uses code first approach to declaring contracts. You can keep your contracts (C# POCO classes) in a separate class library and share the library with the clients through a Nuget package.

When you use the `protobuf-net.Grpc` library, you don't need to generate proto files manually, in fact, they are not even generated or used by the library. Note that protobuf is just a serialization format and it does not mandate declaring proto files.

One of the key areas where I struggled with was guidance on writing integration tests for gRPC services. With `protobuf-net.Grpc`, writing integration tests is drop dead simple. In fact, during code review, my team did not initially realize that they were reading tests written for gRPC endpoints because they look similar to the integration tests for REST endpoints.

I can't contain it any longer, so let's jump into the code.

## Scenario & Code

We wil build a simple application that returns the sequence of numbers starting from 1 to the upper limit specified in the request. You can inspect the source code of the application from the following link.

Let's build the service first.

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
