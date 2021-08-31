---
title: Kong draft
date: 2021-08-03
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

https://konghq.com/blog/kubernetes-kong-konnect/

kubectl run curl-po --image=radial/busyboxplus:curl -i --tty --rm

curl prices-api-service.pricing-ns.svc.cluster.local

//https://cloud.redhat.com/blog/modern-application-development-with-kong-konnect-enterprise-and-red-hat-openshift

//https://blog.dreamfactory.com/what-is-a-reusable-api/#:~:text=You%20don't%20always%20need,make%20information%20easier%20to%20track.

## Reusable APIs

1. Modern enterprise applications are built on an orchestration of a complex network of microservices.
2. As the organization evolves, the number of applications, the number of microservices and the complexity of orchestration increases.

Some considerations for building re-usable APIs:

1. Bespoke API development and management for each application takes a lot of time and effort.
2. Implementing cross cutting concerns such as security, logging, and monitoring consistently across services.
3. You have different databases that don’t connect easily.

Benefits of reusing APIs:

1. Low number of services to manage.
2. Lower DevOps spend.
3. Higher security with lower attack surface.

Reusable APIs require a feature rich API platform that has in-built support for industry best practices of security, scalability, and monitoring. Without a feature rich API platform, your run the risk of applying uniform policies across services, and monitoring the services in a consistent manner. Also, since the services are serving multiple applications, every API can affect several applications.

## Solution: Kong Konnect

Kong provides three API proxy components that are used to manage and operate underlying services:

1. Ingress Controller: Inter-app connectivity in a Kubernetes environment.
2. Kong Mesh: In-app connectivity between services in Kubernetes or Cloud environment.
3. Gateway: Edge connectivity for services with clients.

Kong Konnect brings these services together on a single platform to provides visibility of the entire Kong environment and service catalog capabilities for every microservice managed by it.

Every component of the Kong platform defines 2 layers:

1. Control plane: capabilities to define API and policies e.g., authentication, rate limiting.
2. Data plane: control exposure of APIs with the policies defined in the control plane.

## Horizontal Concerns of Microservices

1. Enterprise policies: Autntication, Routing, Rate limiting, Logging, Monitoring, etc.
2. Security: Kong Auth plugins (https://docs.konghq.com/hub/) allows you to define policies for authentication and authorization of end users and services.
3. Communication: Request transformation plugins allow you to specify how the services can communicate in sync and async manner.
4. Deployment: Deploy Kong on your preferred Cloud.

## APIOps with ServiceHub

Allow developers to use Insomnia to define the API specs in a declarative way in Git. Enables operators and consumers to verify the specs and test the services to ensure that they meet their needs.

The ServiceHub provides a single source of truth for every service in the environment and enables developers to deploy new services using the same declarative code.

## Example: Pricing Service of an E-commerce App

Simple service that returns the price of a product based on the product ID.

## Step 1: Set up a Kong Konnect account

## Step 2: Generate Specs with Insomnia

## Step 3: Adding Authentication

## Step 4: Adding Rate Limiting

## Step 5: Logging to Loggly

## Conclusion

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
