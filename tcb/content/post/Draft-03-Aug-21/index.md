---
title: Setting Up Reusable APIs with Kong Konnect
date: 2021-08-03
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

--> Note to rename it to Kong gateway runtime (data plane)

Modern enterprise applications are built on the orchestration of a complex network of microservices. Over a period of time, as the applications and microservices increase, the complexity of the orchestration increases as well.

{{< img src="1.png" alt="Complexity in applications composed of microservices" >}}

Reusable APIs address this problem by allowing multiple applications to rely on a few independent microservices that expose the knowledge and operations of their domain.

## Why should we build reusable APIs?

API sprawl is a growing issue. It is not uncommon to hear from architects that their organizations have hundreds of APIs and many of them are unknown to the other teams in the company. The lack of visibility leads to creation of even more duplicate APIs which just add to the existing problem.

API sprawl is dependent on scale and so it might not be a problem for small organizations that have a small number of applications, services, and databases. On the other hand, for a large organization bespoke API development might consume a lot of development time and effort.

Some key issues of API sprawl are:

1. Managing the APIs gets harder as the number of APIs increases.
2. Diverse databases are introduced that do not support interoperation.
3. Cross cutting concerns such as security, logging, and monitoring are hard to implement consistently.

Reusable APIs are not specific to any one application and hence fewer in number. There have several benefits of introducing reusable APIs as follows:

1. APIs can be easily catalogued and maintained.
2. Building a new application won't require creating a new API. The reduced development cost will also reduce the time to market.
3. Reduced spend on security. Due to fewer connections between applications and web services, you can easily control and monitor access to your digital assets.
4. Applications and services can be scaled and migrated independently.

Adopting reusable APIs can be a major challenge without a comprehensive API platform that supports the industry best practices of security, scalability, and monitoring out of the box. Without an API platform, addressing standard API concerns such as the following can become a major challenge:

1. Applying policies such as security, logging, and caching uniformly across all APIs.
2. Monitoring the APIs in a consistent manner.
3. Maintaining documentation for the APIs.
4. On demand creation of applications and connections to the APIs through an application developer managed platform.

Reusable APIs serve a lot of applications simultaneously and hence every API is critical to the operation of the organization.

## How Kong Konnect helps developers with managing reusable APIs

Kong is an open-source API platform that acts as middleware between compute clients and APIs. The Kong platform contains a variety of plugins that allows you to easily extend the capabilities of APIs. Developers and Product owners can use the Kong platform create self service portals for developers interested in consuming the APIs, manage the registrations, and adjust for scaling.

The Kong platform consists of the following three API proxy components (called runtimes) that are used to manage and operate the backend services:

- **Ingress Controller**: Inter-app connectivity in a Kubernetes environment.

- **Kong Mesh**: In-app connectivity between services in Kubernetes or Cloud environment.

- **Gateway**: Edge connectivity for services with clients.

The Kong Konnect offering brings the components together on a single platform. Enterprises deploy their APIs on various platforms such as Kubernetes, Cloud, and on-premise. Based on the platform, you can choose the appropriate proxy component for your API and leverage the

Irrespective of the Kong runtime that you choose, you can use the plugins and tools of the Kong ecosystem to manage the backend APIs. At the core of Konnect platform is the Service Hub which provides service catalog capabilities for the and end-to-end lifecycle management of services managed by the platform.

{{< img src="2.png" alt="Kong Konnect platform credit: Kong" >}}

Every Kong runtime is composed of two fundamental components:

1. **Control plane**: The control plane provides operators the ability to define routes, telemetry, and policies such as authentication, routing, and rate limiting.
2. **Data plane**: The data plane controls the exposure of the backend APIs as per the policies defined in the control plane. The data plane is responsible for routing the network traffic, enforcing the policies and emitting the telemetry.

## Addressing the horizontal concerns of microservices with Kong

Leveraging an API gateway helps you decouple:

1. External network from internal network.
2. External API interface from backend API interface.
3. External API version from internal API version.

Some broader API concerns that can be addressed with an API gateway such as Kong are:

1. Enterprise policies: Operations team can enforce policies without affecting the business APIs such as:

   - Authentication: Basic, API Key, LDAP, mTLS, OAuth/OIDC, and others.
   - Traffic control: Canary Release, caching, rate limiting, and others.
   - Monitoring and analytics
   - Logging: Data stream, file log, StatsD, and others.

2. Security: API gateways can be placed in the [DMZ](<https://en.wikipedia.org/wiki/DMZ_(computing)>) so that the security teams can apply strong policies to mitigate the risks on the API gateways. The backend APIs are not part of the DMZ and hence their security standards can be much lower. Also, the backend APIs have low risk of receiving invalid messages because the messages are inspected in the DMZ and illegal messages are not allowed to propagate further.

Kong offers a [wide range of plugins](https://docs.konghq.com/hub/) that the security teams can use to address the security concerns of API gateways.

{{< img src="3.png" alt="Kong security plugins" >}}

3. Request transformation: Kong supports transforming the requests and responses so that heterogenous services can communicate with each other. Kong can not only transform synchronous messaging protocols such as gRPC to REST, and REST to GraphQL, but also transform synchronous requests to asynchronous requests with plugins such as REST to Kafka messages.

{{< img src="4.png" alt="Kong transformation plugins" >}}

4. Deployment: You can deploy Kong to popular cloud or container platforms such as AWS, Azure, Heroku, and Kubernetes on any cloud.

## What is ServiceHub, and what is its role in APIOps?

The concept of APIOps is quite simple: bring DevOps and GitOps to the API and microservices lifecycle.

Let's discuss how the suite of Kong tools: [Insomnia](https://insomnia.rest/), Insomnia CLI ([Inso](https://support.insomnia.rest/collection/105-inso-cli)), and [decK](https://docs.konghq.com/deck/) can help you implement APIOps for your microservices. Following are the typical stages of an AIOps deployment pipeline:

1. **Design stage**: Developers can use Insomnia to design API specs and write tests for your API. Insomnia will instantly lint your OpenAPI specs and validate them. You can define Kong plugins and policies that need to be applied to your API endpoints for proper governance and security. Next, you can use Insomnia to generate the declarative config that can be used to set up a local Kong gateway to verify the setup on your system.

{{< img src="6.gif" alt="Generate Kong declarative config" >}}

You can leverage the built-in Git Sync feature to push your API to the right repository.

2. **CI stage**: Once the new code is in the repository, the Inso CLI can be used by the reviewer and the build system to run automated tests and OpenAPI specification linter. After validating the quality and governance is validated, Inso can generate declarative config for Kong.

3. **Deployment stage**: The declarative config can be used by the decK CLI to adjust the state of the Kong runtime. decK maintains the state of the Kong runtime and it can use the declarative config to detect the drift between the desired state and the runtime. Once the drift is detected, decK can automatically bring the runtime to the desired state.

Once the deployment is complete, the new API specs can be published to the Kong developer portal using the [DevPortal CLI](https://docs.konghq.com/hub/devportal-cli/). The new API specs can be used by the API developers to create new applications without requiring further coordination with the API team.

Following diagram illustrates the stages of an APIOps deployment pipeline that we discussed:

{{< img src="5.png" alt="APIOps pipeline credit: Kong" >}}

## See it in action: (Example) Pricing Service for an E-commerce application

The most common example of microservices is an e-commerce application that uses several services to power the customer experience.

Product pricing is one of the common concerns of several applications in the e-commerce ecosystem such as the customer facing application for the customers and the finance application for the internal finance team. We can build a single reusable product pricing service that fulfils the concerns of both the applications. Single pricing service will ensure that the pricing information is always consistent and accurate. The development teams in the organization can build new products by using the same service and thus reaching the market faster. Also, new pricing features such as discounts and taxes can be added to the pricing service quickly and made available to all the applications in the organization quickly.

We will cover the steps to roll out the product pricing service to the developers in the organization in the following sections. We will deploy the pricing service in Kubernetes and use the Kong Kubernetes runtime to act as a proxy for the service.

## Setup a Kong Konnect Account

Sign up for the [Kong Konnect](https://kong.konghq.com/kong-konnect/) account. You can start with the free tier and upgrade to the other pricing tiers based on your need. Kong Konnect has a great set of resources to help you get started. You can follow their [getting started documentation](https://docs.konghq.com/konnect-platform/guides/), [blog post](https://konghq.com/blog/getting-started-konnect) or [video](https://www.youtube.com/watch?v=FbjKsEGaQ1o) to familiarize yourself with the platform.

Also, prepare a Kubernetes cluster in AWS, Azure, or GCP for deploying your service and the Kong runtime. I created a single node Kubernetes cluster on AKS.

{{< img src="7.png" alt="One node cluster in AKS" >}}

We will get back to our cluster soon. Let's prepare the Pricing API now.

## Write API Specs with Insomnia

Download and install [Insomnia](https://insomnia.rest/) on your system. Click on the **Design** tab which will launch the editor where you can write the OpenAPI specs for the Pricing service.

Our API contains a single endpoint: **/price/{product id}** which is used to fetch the price of a product. Write the following spec in the editor and inspect the preview in the split pane.

```yaml
openapi: 3.0.0
info:
  description: Prices API is responsible for managing the latest prices of products.
  version: 1.0.0
  title: Prices API
paths:
  "/price/{id}":
    get:
      tags:
        - price
      summary: Find price by item id
      description: Returns the price of a single item
      operationId: getPriceById
      parameters:
        - name: id
          in: path
          description: ID of item
          required: true
          schema:
            type: integer
            format: int64
      responses:
        "200":
          description: successful operation
          content:
            application/xml:
              schema:
                $ref: "#/components/schemas/Price"
            application/json:
              schema:
                $ref: "#/components/schemas/Price"
        "400":
          description: Invalid ID supplied
        "404":
          description: Item not found
servers:
  - url: http://prices-api-service.pricing-ns.svc.cluster.local
components:
  schemas:
    Price:
      type: object
      properties:
        id:
          type: integer
          format: int64
          example: 1
        value:
          type: number
          format: decimal
          example: 30.5
        currency:
          type: string
          example: USD
        validUntil:
          type: string
          description: date till which the price is valid
          example: 2019-05-17
      xml:
        name: Price
```

{{< img src="8.png" alt="OpenAPI spec for the Pricing service" >}}

You can read more about the Git integration to share your work with the team in the [Insomnia guide](https://support.insomnia.rest/article/193-git-sync). You can also debug and test your API [with Insomnia](https://support.insomnia.rest/article/194-unit-testing).

I have published the Docker image for the API based on the spec we wrote to the [Docker Hub](https://hub.docker.com/repository/docker/rahulrai/prices-api). Following is the .NET implementation of the API which is also available in the [GitHub repository](https://github.com/rahulrai-in/prices-api) for your reference:

```c#
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/price/{id}", (int id) => new Price(id, id * 3.5, "USD", DateTime.UtcNow + TimeSpan.FromDays(5)));

app.Run();

record Price(int Id, double Value, string Currency, DateTime ValidUntil);
```

Use the following Kubernetes specification to deploy the service to your cluster.

```yaml
kind: Namespace
apiVersion: v1
metadata:
  name: pricing-ns
  labels:
    name: pricing
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prices-api-deployment
  namespace: pricing-ns
  labels:
    app: prices-api
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prices-api
  template:
    metadata:
      labels:
        app: prices-api
    spec:
      containers:
        - name: prices-api
          image: rahulrai/prices-api:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "64Mi"
              cpu: "250m"
            limits:
              memory: "128Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: prices-api-service
  namespace: pricing-ns
spec:
  ports:
    - port: 80
      targetPort: 8080
      protocol: TCP
      name: http
  selector:
    app: prices-api
---
```

You can inspect the service ports by running the following command in a `kubectl` shell:

{{< img src="9.png" alt="Inspect the Prices API service" >}}

## Configuring the Kong Runtime

Kong Konnect manages your control plane for you and let's you use the Konnect portal or decK CLI to configure the required plugins that will help you add security and governance to your service.

The data plane component which will work according to policies defined in the control plane will be hosted in our cluster. We will now install the data plane component and connect it to the control plane.

Navigate to the Konnect portal and click on the **Runtime** option. Open the Kubernetes tab and click on the **Generate Certificate** button. Kong will generate the certificates that your data plane can use to establish a secure connection to the control plane. Copy the certificates and the unique Helm chart parameters files for your runtime.

{{< img src="10.png" alt="Collecting configurations for the data plane" >}}

Follow the instructions in the [Kubernetes runtime configuration guide](https://docs.konghq.com/konnect/runtime-manager/gateway-runtime-kubernetes/) to set up a runtime with the certificates and configuration parameters.

After installing the runtime, you can get the external IP address of the Kong gateway by executing the following command:

```shell
kubectl get service my-kong-kong-proxy -n kong
```

{{< img src="11.png" alt="External IP address of the Kong gateway" >}}

Record the External IP address of the proxy which is the access point for your data plane.

Once connected, you can view your runtime on the Runtimes page as follows:

{{< img src="12.png" alt="Your Kong runtimes" >}}

We now have our service running in the cluster, and our data plane is connected to the control plane. We now need to create a service in the [Service Hub](https://konghq.com/kong-konnect/#servicehub) and create a route to enable the data plane to communicate with the Price API service.

{{< img src="13.png" alt="Creating a service in the Service Hub" >}}

We now need to link the gateway to the upstream service. This linking is done by creating an implementation for the service. Click on the current version of the service and next on the **Add New Implementation** button.

You first need to specify the URL of the upstream service. The default URL of a service in Kubernets is follows the format: `http://<service-name>.<namespace>.svc.cluster.local:<port>`.

You can also extract the URL of a service in the cluster by executing the `nslookup` command in the shell of a pod as follows:

```shell
kubectl run temp-pod --rm -i --tty --restart=Never --image=radial/busyboxplus:curl -- nslookup prices-api-service.pricing-ns
```

{{< img src="14.png" alt="Lookup the address of the Prices API service" >}}

Enter the URL of the service in the **URL** field of the form and click on the **Next** button.

{{< img src="15.png" alt="Submit the URL of the Prices API service" >}}

Since the API gateway can interface multiple upstream services, you must specify the route path that the gateway will use to route the request to the service. We will configure the route such that request to path `/api/` will be routed to the service as follows:

{{< img src="16.png" alt="Configure the route" >}}

Click on the **Create** button to create the route. Since the communication between the control plane and the data plane is quick, we can send a request to the Price API service via the gateway available at the external IP address that we previously recorded as follows:

```shell
curl http://<kong-external-ip>/api/price/<any-number>
```

{{< img src="17.png" alt="Send a request to the Price API service via Kong" >}}

You can view the traffic sent to the API in the [Kong Vitals](https://konghq.com/kong-konnect/#vitals) data. I simulated some successful requests and some errors to showcase how the data is displayed.

{{< img src="18.png" alt="Kong vitals stats" >}}

Let's now makes the Price API available to the developers of our organization.

## Publishing the API to the Dev Portal

On the version details page, you will find the a **Version Spec** sections where you can upload the API specification that you created in Insomnia previously. This will help the developers understand the request and response formats of your API before building their applications on it.

From the service details page, you can upload a Markdown formatted documentation of your API for the developers to read.

{{< img src="19.png" alt="Upload API documentation" >}}

To publish your service to the Dev Portal, click on the **Publish to Portal** option in the **Actions** menu.

{{< img src="20.png" alt="Publish your service to the Dev Portal" >}}

To allow developers to use this service in their applications, click on the **Enable app registration** from the menu as well.

When you enable this option, an application will have to present its identity to the Kong gateway in order to access the service. You can choose between API key based authentication (key-auth) and OAuth2 based authentication (openid-connect). For simplicity, choose the key-auth option. You can also enable the **Auto approve** toggle to automatically approve the applications that developers register with your service. Click on the **Enable** button to complete the process.

{{< img src="21.png" alt="Enable app registration" >}}

Click on the **Dev Portal** option to view the list of published services in the Dev Portal and the link to the Dev Portal.

{{< img src="22.png" alt="Dev Portal details" >}}

Visit the Dev Portal in a new tab and register for an account. Head back to the Konnect portal and click on the **Connections** and then the **Requests** option to view the developer registration request. You can approve the request by clicking on the **Approve** button.

{{< img src="23.png" alt="Approve the developer registration request" >}}

Use the approved account to access the self service developer portal. You will find the Prices API in the list of services available to you for building applications. Click on the Price API service tile.

{{< img src="24.png" alt="List of services available to developers" >}}

If you uploaded the API spec in the Service Hub, you will find the UI for your API here. Developers can easily view the endpoints and understand the schema of request and response from this view.

{{< img src="25.png" alt="Price API specification" >}}

Click on the **Register** button to begin registering the API with an application. Since you don't have any applications right now, the next dialog will ask you create a new application. To create a new application, click on the **Create Application** button.

{{< img src="26.png" alt="Create a new application" >}}

Enter the details of the new application and click on the **Create** button.

{{< img src="27.png" alt="Enter details of the new application" >}}

Finally click on the **Request Access** button to request access to the API.

{{< img src="28.png" alt="Request access to the API" >}}

Since, in the Service Hub, we configured the service requests to be automatically approved, we can use the service in our application without requiring another approval.

We now need an identity of the application to access the API. Click on the **Generate Credential** button to generate a new credential for the application. It will instantly generate an API key that you can use to access the API.

{{< img src="29.png" alt="Generate an API key" >}}

Let's use this credential to access the API as follows:

```shell
curl --request GET 'http://<gateway-ip>/api/price/50' --header 'apikey: <api-key>'
```

{{< img src="30.png" alt="Access the API using the API key" >}}

Let's try to add a plugin to limit the number of requests received by our API per minute.

Head back to the Konnect portal and navigate to version view of the API in Service Hub. Click on the **New Plugin** button in the Plugins tile.

{{< img src="31.png" alt="Add a new plugin to the gateway" >}}

Search for the **Rate Limiting** plugin and click on the **Enable** button.

{{< img src="32.png" alt="Enable the Rate Limiting plugin" >}}

Configure the plugin to allow a maximum of 2 requests per minute by setting the value of the property `Config.Minute` to 2. Also, set the value of the property `config.policy` to local to enable the gateway to persist the state in the local memory.

{{< img src="33.png" alt="Configure the Rate Limiting plugin" >}}

Click on the **Create** button to add the plugin to the list of plugins active on the service version.

Try sending multiple requests to the API and observe the response. You will see that the requests start getting throttled after the second request as follows:

{{< img src="34.png" alt="Rate limiting plugin in action" >}}

You can likewise add more plugins to enforce other policies on your APIs. You can find the list of available plugins and their documentation on the [Kong Plugin Hub](https://docs.konghq.com/hub/).

## Conclusion

Adopting the principle to use reusable APIs can help an organization eliminate the waste of precious resources by reusing the same API for multiple applications. Reusable APIs can make your microservices ecosystem easier to maintain and improve the velocity of your application development.

The Kong Konnect platform and its family of tools can help you implement APIOps and automate the delivery and management of reusable APIs.

Kong Konnect enforces a clear separation between Operations and Application developers through the Service Hub and the Developer Portal. The Service Hub allows the operations to onboard APIs and manage their versions and the Dev Portal enables the application developers to be autonomous. The Kong Plugin Hub allows the operations team to enforce organization specific policies across the APIs.

With Kong Konnect, the burden of implementing non-functional requirements in regard to a business API is no longer the responsibility of the developers. Each team can concentrate on its own strengths.

{{< subscribe >}}
