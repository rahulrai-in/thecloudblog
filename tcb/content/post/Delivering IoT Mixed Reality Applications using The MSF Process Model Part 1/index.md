---
title: "Delivering IoT Mixed Reality Applications using The MSF Process Model (Envision and Plan) – Part 1"
date: 2018-06-24
tags:
  - azure
  - internet-of-things
  - mixed-reality
comment_id: f8d6349a-0048-4d4d-96a5-43541de3552a
slug: delivering-iot-mixed-reality-applications-using-the-msf-process-model-envision-and-plan-part-1
---

> In this series
>
> 1. [Envision and Plan](/post/delivering-iot-mixed-reality-applications-using-the-msf-process-model-envision-and-plan-part-1/)
> 2. [Develop and Stabilize](/post/delivering-iot-mixed-reality-applications-using-the-msf-process-model-develop-and-stabilize-part-2/)
> 3. [Develop, Stabilize, and Deploy](/post/delivering-iot-mixed-reality-applications-using-the-msf-process-model-develop-stabilize-and-deploy-part-3/)

Delivery of enterprise scale projects requires a cohesive and structured framework in place. A robust delivery framework ensures that projects are carefully planned, and roles and tasks are identified and defined.

Microsoft has developed a set of principles, models, disciplines, concepts, and guidelines for delivering information technology services known as [Microsoft Solutions Framework (MSF)](<https://msdn.microsoft.com/en-us/library/jj161047(v=vs.120).aspx>). By following MSF principles, teams can improve the rate of success, solution quality, and business impact. It is important to note that application of MSF is independent of the nature of projects such as development, and infrastructure and that its use is not tied to a particular methodology such as the [Waterfall model](https://en.wikipedia.org/wiki/Waterfall_model) or [Agile](https://en.wikipedia.org/wiki/Agile_software_development).

MSF is divided into three parts, a team model, a process model, and a risk management discipline. While concentrating on all areas of MSF is necessary, we will keep our focus directed to the process model of MSF in this article. We will build a complete Mixed Reality (MR) Internet of Things (IoT) enterprise application while going through all the phases of the MSF process model. This discussion will be a fascinating, and extensive look into the process.which will be spread out in three different parts, each covering a unique aspect of the process model. Let's first start with understanding what the MSF process model is.

## MSF Process Model

The MSF process model outlines set of activities that need to be carried out to develop and deploy enterprise IT projects. Delivery in MSF is iterative and encourages short development cycles in conjunction with iterative development.

{{< img src="1.png" alt="Phases and Milestones in MSF (Source: Microsoft)" >}}

Each iteration in MSF is split into phases and a milestone caps each phase. It is crucial to meet acceptance criteria and complete essential deliverables in each phase to complete a milestone.

## Overview of Phases in MSF

As you can see in the diagram that the model is made up of several phases. Let's briefly discuss the phases that make up the MSF Process Model.

### Envisioning Phase

The focus of this phase is the unification of the project team behind a shared vision. The goal of the envisioning phase is for the team to have a clear vision of what it wants to accomplish. At the end of this phase, the team should organize the project, and deliver an approved vision or scope document.

### Planning Phase

During this phase, the team should prepare the functional specification, conceptual, logical, physical designs, develop work plans, cost estimates, and master project schedules for the deliverables.

### Development Phase

In the Development phase, most of the solution components, which include code and documentation, are built as per specifications. In this phase, the planned tasks, designs, specifications, and requirements are implemented to achieve the desired result.

### Stabilization Phase

During this phase, the team completes testing the solution and releases the solution to a controlled user group for acceptance and to gather reviews. In this phase, the solution is tested with real-world scenarios to ascertain that the solution meets acceptance criteria for release to production.

### Deployment Phase

During this phase, the team deploys the solution components, stabilizes the deployment, transitions the project to operations and support, and obtains final customer approval of the project. Feedback is then gathered once release to production which can be garnered in a number of ways, one of which may be the use of customer satisfaction surveys to collect feedback from the end users.

## MSF for IoT Mixed Reality Applications: Envisioning and Planning

Let's now direct our attention to the first two phases of the MSF and how they apply to delivering an IoT MR Application using HoloLens. For this discussion, we will consider that we are working for a smart agriculture company that has a workforce to manage the crop plantation. Since, crop irrigation is a very time consuming, resource intensive, and error-prone task, the company is looking forward to automating most of these tasks. We are tasked with building an automated irrigation solution that based on the soil humidity, and atmospheric conditions can irrigate the crops with just the right amount of water. Additionally, the system should also alert the workforce in case of failures or when manual intervention is required. This scenario is based on a potential use case scenario detailed in the Wikipedia article [here](https://en.wikipedia.org/wiki/Internet_of_things#Agriculture). Let's build this solution in a phased manner starting with the Envisioning phase.

## Envisioning Phase

In this phase, a meeting is scheduled with the stakeholders to understand their requirements and vision in detail. Common brainstorming techniques such as sticky notes and mind-maps can be used to elicit the requirements in the meeting. Here is a what our whiteboard looked like after our meeting with the customer.

{{< img src="2.jpg" alt="Envisioning IoT MR Solution with Sticky Notes" >}}

From the envisioning session, we understood the client's vision of building the smart agriculture system. The customer wants to receive data from the various sensors that are planted across the field and apply the data to prediction systems to predict resource requirements. Finally, the aggregated data should be viewable to the administrators through Power BI dashboards and to the field workers through a HoloLens device. Viewing data through MR device will help field workers quickly locate and fix any sensors or cater to conditions that require human intervention.

Using the requirements, we can come up with an architecture for the solution. The desired system has a series of components, and simply trying to articulate these are major high-level components, which in turn may be made up of smaller components.

1. **Data Producers\Sensors**: The customer has installed several types of sensors such as water quality sensor, and humidity sensors amongst others across the field. These sensors can send data to a centralized event processing system. The solution should continuously process the data generated by these sensors and take appropriate actions.
2. **Data Ingestion and Streaming Systems**: These are centralized systems to which all the sensors will connect and stream data to at regular intervals. The data ingestion component is made up of five smaller sub-components.
3. **Gateway**: The gateway handles operations such as sensor connectivity, data filtering, security, management and more. The gateway should be capable of handling high volume data ingress.
4. **Provisioning Service**: The provisioning service handles sensor enrolment. The service is responsible for assigning devices to IoT Hubs and load balancing devices across multiple hubs.
5. **Stream Processor**: This component is responsible for analyzing a stream of data received by the Data Ingestion layer and push the data to storage. This service can perform temporal analysis, which means an examination of data over a period, on a stream of data to trigger operations.
6. **Storage**: This is the resident store for all the data that is streamed by the sensors to the Integration system. This data storage media can be classified into the following two categories.
   1. **Hot Storage** : This storage holds the most recent data that is transmitted by the devices. This storage should support high ingestion thresholds and can be used to build near real-time dashboards.
   2. **Cool Storage** : After a specified period data should be moved from hot storage to high volume storage that can surface data for Big Data analytics solutions.
7. **Analytics and Machine Learning**: The analytics systems analyze the data in storage and apply machine learning algorithms to the data to predict malfunctions and prevent incidents.
8. **Visualization**: A Mixed Reality (MR) applications can be used in conjunction with a web dashboard to perform two types of visualizations of data.
9. **Synchronous monitoring**: This method involves active monitoring of sensors using a HoloLens MR application. Using this visualization technique, a user can view device state in real-time in 3D space. The MR application connects to the hot data storage via a service and surface sensor state in real time in 3D space. The application allows the user to take corrective action from the application itself.
10. **Asynchronous monitoring**: This method involves passive monitoring of sensors using an MR application. The application uses data that is surfaced by the analytics and the machine learning systems to make recommendations. In case of an incident, the user can take corrective actions from the application itself.

## Technology Stack

Before writing any code to build an application, you will need to select the technology stack that will power your application. Choosing the right combination of tools and frameworks that developers will use to create the applications is very important. Your choice of the technical stack will be a commitment that can't be easily reversed, so it is crucial for you to evaluate all possible risks before adding new technology in the mix.

Let's evaluate some of the various options that are available to us for building our application. Let's start with the data ingestion component for evaluation.

### Cloud Gateway Technology Options

1. **Azure IoT Hub**: It is a high scale service that enables secure bi-directional communication between a variety of devices and cloud backend. Azure IoT Hub supports multiple well known IoT protocols as well as multiple consumers for cloud ingestion.
2. **Azure Event Hub**: It is high throughput ingestion only service for collecting data from concurrent sources. Event Hubs do not offer device identity or device command services and also does not support as many IoT protocols as Azure IoT Hub.

We can see that because of its merits, Azure IoT Hub service should be used as our Cloud Gateway to enable remote communication to and from devices and field gateways.

### Device Identity Service

1. **Azure IoT Hub**: Azure IoT Hub service includes an inbuilt identity store that provides the IoT Hub service with authentication and authorization capabilities.
2. **Custom Solution**: Device identity can be saved as a record in Azure Cosmos DB, Azure Table, SQL Database, or in databases such as Cassandra.

Since our solution does not require a custom device identity solution, we can use the existing investment that we made with Azure IoT Hub to support device identity as well.

### Stream Processing

A stream processing service can evaluate rules for a large stream of data records. For applications that require complex rule processing at scale, Azure Stream Analytics service should be used. For simple processing rules, Azure IoT Hub Routes and Azure Functions can be used.

### Warm Storage

Some of the essential prerequisites for a warm storage service are quick indexing of data on ingestion and simple querying capability for simple scenarios such as visualizing current device sensor values. In Azure, there are both Azure managed and self-managed services available for the purpose.

1. **Azure Cosmos DB**: It is a secure, scalable, and low latency NoSQL database. Using Azure Cosmos DB is recommended if the scenario does not require querying an aggregation of large sets of data.
2. **Azure SQL DB**: If the data requires relational query and storage capabilities, then Azure SQL Database should be preferred. This database might not be useful in many IoT scenarios, because of the limits on the scale, and on the throughput of write operations.
3. **Apache Cassandra**: This is a self-managed NoSQL database service which is scalable, and highly available. It supports a high rate of database writes operations which makes it suitable for IoT scenarios.

It is recommended to use Azure managed services to save efforts on operation overheads. Therefore, we will use Azure Cosmos DB in our scenario.

### Cool Storage

An ideal cool storage database service should be cheap to persist and query data. Data in cool storage can be used in future for reporting, analysis, machine learning use, etc.

1. **Azure Blob Storage**: It is a simple, and inexpensive file storage database. The Azure blob storage service supports encryption, geo-redundancy, high availability, and high scalability.
2. **Azure Data Lake**: Azure Data Lake can store both relational and nonrelational data. This storage should be preferred if Big Data analytics is required. This service is slightly more expensive, has lower availability, and redundancy than Azure Blob storage service.

You can perform a similar analysis for choosing the rest of the services for your technology stack. Once the team and stakeholders are in agreement with the technology stack for the application, the team can proceed to the next step.

## Scenario Structuring

Scenario structuring is the final process involved in the Envisioning phase. After identifying the scenarios, the next step is to order the scenarios so that they can be taken on to the next phase of the development. The envisioning meeting or a follow-up meeting might be utilized to carry out this exercise. In this meeting, the team discusses the scenarios, the priority of delivery, and dependencies.

There are several prioritization strategies that Product Managers and teams can use to determine what features of the product could better contribute to achieving the main goals of the project. Let's take a look at some of them.

1. **Kano Model**: The Kano model is a two-axis grid which compares product investment with customer satisfaction. The various product features are placed in this grid and classified as basic features, delightful features, and satisfiers. Investments and priority of features can then be evaluated.
2. **Cumulative Voting**: In this approach, individual team members are allocated an imaginary fixed sum currency. The members are asked to spend the currency on the features individually. The features can later be prioritized by calculating the total units allocated to each feature.
3. **MoSCoW Analysis**: Using this technique, the requirements can be categorized into four groups:
4. **Must**: Requirements that must be satisfied for successful completion of the project.
5. **Should**: High-Priority requirements that should be included in solution if possible.
6. **Could**: Desirable requirements that are not a necessity.
7. **Won't**: Requirements that will not be implemented but might be considered in a future release.

Using one of the above-mentioned strategies, the team comes up with a prioritized list of features. Here is a partial view of features that we will work on.

{{< img src="3.png" alt="Feature Prioritization" >}}

After looking at the priority of features, our team decides to take up Active Monitoring scenarios before working on the Passive Monitoring scenarios. With the identification of features that need to be worked on, the team moves on to the next phase of delivery.

## Planning Phase

In this phase, the team would work on a plan to deliver the Active Monitoring features of the solution. The application should be able to receive real-time data from the sensors to display real-time statistics to the users. The team decides to use the [IoT Remote monitoring preconfigured solution architecture](https://docs.microsoft.com/en-us/azure/iot-suite/iot-suite-remote-monitoring-sample-walkthrough) defined by Microsoft to realize this objective. The following are the various components involved in this architecture.

{{< img src="4.png" alt="Microsoft IoT Architecture Reference" >}}

### Devices

Devices are the actual sensors that emit telemetry. In our case, the devices include humidity sensors and, water quality check sensors. These devices can be of one of the following types:

1. **IP-capable**: These devices can connect directly to a Cloud Gateway such as Azure IoT Hub over the internet.
2. **Low-power devices**: These devices use a low power technology such as Bluetooth LE and cannot connect directly to a cloud gateway. These devices require a component such as a device gateway (e.g., [IoT Edge](https://azure.microsoft.com/en-gb/services/iot-edge/)) to transmit data to the Cloud Gateway.

### Cloud Gateway – Azure IoT Hub

Using the Cloud Gateway, the devices can access the provisioning service, get authenticated and authorized, and later transmit all telemetry data to the cloud. Azure IoT Hub also supports bi-directional communication between sensors and backend systems. The bi-directional communication model allows for commands to be transmitted to the sensors to take corrective measures in case of various events.

### Stream Analytics

Azure Stream Analytics service is capable of receiving a high volume of telemetry data and processing it. Stream Analytics can identify messages and route them accordingly to downstream systems that handle that type of messages. Stream Analytics supports native integration with several cloud services that can save the processed data such as Azure Data Lake, CosmosDb, and so on.

### Data Storage

The data is permanently persisted in the data stores after processing. In general, raw data is persisted in a low cost and high volume data store such as Azure Data Lake. Once data is processed, it can be persisted in low latency and high throughput data stores such as Azure SQL Database or Cosmos DB.

### Machine Learning &amp; Prediction Service

Several independent Machine Learning predictive analysis services can be trained using the raw data persisted in Azure Data Lake and be later used to make predictions. The trained Azure ML experiments may be published as services that can predict outcomes based on incoming telemetry data and persist the results in data stores.

### Visualization

The processed data can be visualized through online dashboards and MR devices such as HoloLens. Since a holographic application is a specialized Universal Windows Platform Application, it can communicate with any service accessible over the internet. We will develop an API that will be responsible for serving and transforming the data so that the holographic application can consume it.

### Holographic Application

The holographic application is responsible for real-time monitoring of the sensors deployed in the field and suggest actions to the user. The suggestions will help the users make an informed decision and act on them. The holographic application should have the following components.

1. **Primary View**: On the launch of the application, present a hologram of the field and show the various sensors installed in the field.
2. **Sensor Data**: On gazing a particular sensor and air tapping it, the user should be able to see the last recorded telemetry from the sensor.
3. **Fault Recommendations**: In case of failures, the application should get highlighted at the start.

### 3D Model Sketching

In this step, an artist sketches the scenarios on paper and presents it to the customer to suggest corrections to avoid any surprises at the time of delivery. These sketches act as input to the 3D artists, who will create 3D assets for the project. For this demo, we will use free assets available from Unity Asset store.

## Conclusion

In this article, we discussed MSF in depth and started investigating the application of MSF process model in the delivery of an MR IoT Application. Now that we have covered the Envisioning and Planning phases of the MSF process model, we are now ready to jump into the next stage of the development of the project. In the following article, we will work on the first part of the build phase of this project in which we will spin up the backend of the system.

{{< subscribe >}}
