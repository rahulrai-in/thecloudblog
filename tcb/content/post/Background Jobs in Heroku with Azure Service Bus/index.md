---
title: Background Jobs in Heroku with Azure Service Bus
date: 2021-01-14
tags:
  - azure
  - integration
  - heroku
comment_id: 9f4c0a13-9d9c-491b-9249-38556d604382
---

Web applications are optimized for throughput and latency to service a high number of HTTP requests as quickly as possible. For improved performance, web applications defer the CPU intensive, IO intensive, time-intensive, and scheduled processing workloads to **background jobs** that run independently of the user interface. These background jobs must function without intervention from the user interface and should not block a synchronous user and system interaction. Offloading slow and compute or memory-intensive activity to background jobs improves web applications' performance and throughput.

For example, consider an eCommerce web application that captures a customer's orders and triggers the background jobs to process the orders further. The application's background jobs work with the operational data (all orders placed by customers) and the contextual data (orders for a single customer) to update the inventory and shipping systems.

Heroku supports several queue services as add-ons such as [RabbitMQ](https://elements.heroku.com/addons/cloudamqp), [Kafka](https://elements.heroku.com/addons/heroku-kafka), and [IronMQ](https://elements.heroku.com/addons/iron_mq). However, you are not limited to using add-ons for integrating with cloud queue services. In this example, we will build a background job that processes messages from an Azure Service Bus queue. AWS, Azure, and GCP offer message queues as a service that you can use to extend the capabilities of your Heroku applications.

Azure Service Bus offers a rich set of features including support for At-Least-Once and At-Most-Once delivery guarantee. Azure Service Bus also offers First In, First Out (FIFO) messages for both point-to-point (queue) and publish/subscribe communication. While Heroku's application platform is simple, easy to scale, and supports low ceremony DevOps integration, Azure supports an array of enterprise grade services of Azure that can be easily integrated. For complex scenarios, you will find it easy to build applications by integrating the right services across the cloud.

## Background Jobs in Heroku

Heroku allows you to compose your application from [various process types](https://devcenter.heroku.com/articles/process-model) such as web and worker processes. In this demo, we will deploy a simple background worker process that processes messages from a work queue. Heroku allows you to scale the processes in an application independently, which gives you the ability to scale worker instances in proportion to the workload.

Apart from the worker, a feature-rich queue is the next crucial component of an event-driven worker process. [Azure Service Bus](https://docs.microsoft.com/en-us/azure/service-bus-messaging/) queue service allows consumer processes to lock and process messages independently, enabling you to scale the number of worker dynos and achieve high throughput. Let's discuss the Azure Service Bus queue service in detail next.

## Azure Service Bus Queues

The Azure Service Bus service includes [a reliable queue service and a durable publish/subscribe messaging service](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-queues-topics-subscriptions), any of which you can choose based on your needs. Let's focus on the Azure Service Bus queue service, which offers FIFO message delivery. The message receivers of an Azure Service Bus queue receive the messages in the same sequence in which they were added to the queue by the producer.

Service Bus queues act as a buffer between the producer and the consumer of the messages. During the peak load period, the producer can enqueue several additional messages to the queue, which the message consumers can keep processing at the same scale as during an average load period. You can create an Azure Service Bus queue using the [Azure CLI](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-cli) and the [Azure Portal](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-portal), among other options. The Azure Service Bus SDK is available in [many popular programming languages](https://docs.microsoft.com/en-us/azure/service-bus-messaging/) such as C#, Java, Node, and Go.

## The Demo Application

I will use Go and the [Azure Service Bus Go package](https://godoc.org/github.com/Azure/azure-service-bus-go) to build a sample application to demonstrate how we can develop and deploy a background service that reads messages off a work queue, processes them, and prints the results. The following link will take you to the GitHub repository of the application.

{{< sourceCode src="https://github.com/rahulrai-in/azsb-heroku-worker" >}}

The application itself is straightforward. It receives messages from the configured Service Bus queue and prints the message body to the console after a small delay. The deliberate processing delay will help me demonstrate that each worker dyno instance receives a different message from the queue and can process the messages independently and thus scale out if required.

## Building the Application

Start your favorite Go code editor such as VSCode, create a folder for your project, and create a module named **sbworker** using the following command:

```shell
go mod init tcblabs.net/sbworker
```

To work with Azure Service Bus, let's install the [Azure Service Bus Go package](https://github.com/Azure/azure-service-bus-go) and the [Godotenv package](https://github.com/joho/godotenv) to load environment variables from a .env file. The Godotenv package makes it easier to work with applications on development machines and CI servers where several applications might run with each requiring their own set of environment variables. You can read more about this package in the README of [its GitHub repository](https://github.com/joho/godotenv).

```shell
go get github.com/Azure/azure-service-bus-go
go get github.com/joho/godotenv
```

Create a file named **main.go** and create the main method in it as follows:

```go
func main() {
	// Read env variables from .env file if it exists
	loadEnvFromFileIfExists()

	handler := &MessageHandler{}

	// Set background context
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	connStr := os.Getenv("SERVICEBUS_CONNECTION_STRING")
	qName := os.Getenv("QUEUE_NAME")
	if connStr == "" || qName == "" {
		fmt.Println("FATAL: expected environment variables SERVICEBUS_CONNECTION_STRING or QUEUE_NAME not set")
		return
	}

	// Create a client to communicate with a Service Bus Namespace.
	ns, err := servicebus.NewNamespace(servicebus.NamespaceWithConnectionString(connStr))
	if err != nil {
		fmt.Println(err)
		return
	}

	// Create queue receiver
	q, err := ns.NewQueue(qName)
	if err != nil {
		fmt.Println(err)
		return
	}

	for {
		if err = q.ReceiveOne(ctx, handler); err != nil {
			if innerErr, ok := err.(*amqp.Error); ok && innerErr.Condition == "com.microsoft:timeout" {
				fmt.Println("➰ Timeout waiting for messages. Entering next loop.")
				continue
			}

			fmt.Println(err)
			return
		}
	}
}
```

Let's read the code together. The `loadEnvFromFileIfExists` function loads the environment variables from the .env file present in the folder. We will create and populate the .env file later. Also, remember that this feature is only for our convenience. We will use actual environment variables for configuring our application in Heroku.

Next, we instantiated the message handler that will receive and process the messages we receive from the Service Bus queue. We will discuss the message handler in detail later. Since we intend to build a background application, we created a background context with support for cancellation.

Next, we fetched the connection string for the Service Bus namespace and the name of the queue from environment variables. We then created a client to communicate with the service bus namespace, and we also created a client to communicate with the queue. A namespace is a container for all messaging components; in this case, the queue.

Finally, we started the message receiver with the `ReceiveOne` function. We handled the particular case of a timeout error, in which case we recurse the loop and reattach the message receiver to the queue. Note that we passed the `handler` object to the `ReceiveOne` function, which implements the `Handler` interface. This interface only requires defining the `Handle` function that is invoked whenever the receiver can lock a message for processing on the service bus. Let's define the struct `MessageHandler` next.

```go
type MessageHandler struct{}

func (mh *MessageHandler) Handle(ctx context.Context, msg *servicebus.Message) error {
	fmt.Printf("-> Received message: %s\n", string(msg.Data))

	// Processing of message simulated through delay
	time.Sleep(5 * time.Second)

	fmt.Printf("✔ Finished processing the message: %s\n", string(msg.Data))
	return msg.Complete(ctx)
}
```

The implementation of the function `Handle` is straightforward. We log the message data, wait five seconds, and mark the message as complete. Note that you must mark a message as complete after processing; otherwise it will reappear on the queue.

Finally, let's define the `loadEnvFromFileIfExists` function to help us read and load environment variables from a file.

```go
func loadEnvFromFileIfExists() {
	envFile := ".env"
	if _, err := os.Stat(envFile); err == nil {
		if err = godotenv.Load(envFile); err != nil {
			log.Fatalf("Error loading .env file")
		}
	}
}
```

Add a file named **.env** to the folder. We will add the Service Bus connection string and the name of the queue to this file shortly. The last artifact that you need to add to the project is a Procfile. A [Heroku Procfile](https://devcenter.heroku.com/articles/procfile) specifies the processes in your application and the commands executed by the applications on startup. Our application is of the worker process type. To start the application, we need to run the command `sbworker` to launch the module executable generated after Go compiles our application.

## Create Azure Service Bus Queue

Let's spin up an Azure namespace and a queue. I prefer to use the [Azure CLI](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-cli), but you can also use any supported means, such as the [Azure portal](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-portal). The following commands will create a resource group named **azsb-heroku-worker-rg**, an Azure Service Bus namespace named **worker-ns**, and a queue named **messages** in the namespace.

```shell
az group create -l westus -n azsb-heroku-worker-rg
az servicebus namespace create --resource-group azsb-heroku-worker-rg --name worker-ns --location westus --sku Standard
az servicebus queue create --resource-group azsb-heroku-worker-rg --namespace-name worker-ns --name messages
```

Let's now navigate to the [Azure portal](https://portal.azure.com/) to fetch the connection strings of the namespace. Visit the [Azure portal quickstart guide](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-portal) for creating Azure Service Bus namespace and queue if you face difficulty navigating through the portal.

We will create an access policy that grants only the listen permission (receive messages) to the client. Open the Service Bus namespace that you created and click on **Shared access policies**. In the next blade, click on the **Add** button, and on the next panel, provide a name for the policy and select **Listen** from the list of permissions. Finally, click on the **Create** button to finish creating the policy.

{{< img src="1.png" alt="Create listen only policy" >}}

After creating the policy, click on it, and copy the connection string value from the next panel.

{{< img src="2.png" alt="Copy the connection string" >}}

Let's now apply this value to the .env file that we created earlier as follows:

```env
SERVICEBUS_CONNECTION_STRING=<connection string>
QUEUE_NAME=messages
```

Add a .gitignore file to the project and add the pattern .env to avoid committing this file to the Git repository.

You can try running the program on your system with the command `go run main.go` and debug any errors if the application fails to start. Create a GitHub repository and push the code to it. We will connect this repository to Heroku next.

## Create Heroku App

Navigate to the [Heroku dashboard](https://devcenter.heroku.com/articles/heroku-dashboard) and create an app using the [Common Runtime](https://devcenter.heroku.com/articles/dyno-runtime) as follows:

{{< img src="3.png" alt="Create app in Heroku" >}}

After creating your app, add the [config vars](https://devcenter.heroku.com/articles/config-vars) to it, which Heroku will surface as environment variables to our application. Click on the gears icon, and click on the **Reveal Config Vars** button as follows:

{{< img src="4.png" alt="Show config vars" >}}

Create two config vars `SERVICEBUS_CONNECTION_STRING` and `QUEUE_NAME` and set the same value of the variables you set in the .env file earlier.

{{< img src="5.png" alt="Set config vars" >}}

It is now time to connect our GitHub repository to the application. Navigate to the Deployment tab and click on the **Connect to GitHub** button. You will be asked to log into GitHub and grant access to Heroku to your repositories, which you must accept. Search for your repository and connect it as shown below.

{{< img src="6.png" alt="Connect app to GitHub" >}}

In the expanded panel of the deployment view, select the branch you want to deploy to Heroku and click on the **Enable Automatic Deploys** button. Any subsequent commit to your repository now will trigger a build and deployment on Heroku.

{{< img src="7.png" alt="Select the repository branch to deploy" >}}

Since we have already committed our code and do not intend to make any changes to our application, click on the **Deploy Branch** button to immediately kick off a deployment.

Heroku does not automatically create worker dyno instances upon the first deployment. You must use the Heroku CLI or the portal to select the type and the number of dyno instances that you require. Click on the **Dynos** tab and click on the **Edit** button, as shown below:

{{< img src="8.png" alt="Edit dyno configuration" >}}

In the dyno edit view, you can select the compute configuration and the instance count of dynos. Set the count of dyno instances to 2 and click the **Confirm** button.

{{< img src="9.png" alt="Set dyno instance count" >}}

It's now time to run the application by submitting some messages to it from the Azure portal.

## Running the Application

Launch the Azure portal in your browser and navigate to the queue that you created in the namespace. Click on the **Service Bus Explorer** option, which will launch the [Service Bus Explorer tool](https://docs.microsoft.com/en-us/azure/service-bus-messaging/explorer) that you can use to send, receive, and peek (see without lock or delete) messages in your queue. Send a few messages to your queue successively after changing the message text. Remember to keep the Content-type to `Text/Plain`, which is what our receiver expects.

{{< img src="10.png" alt="Send messages to queue" >}}

Open the logs view of your application in the Heroku portal, as shown below:

{{< img src="11.png" alt="View application logs" >}}

In the logs, you can see the two instances processing the messages independently. Also, each receiver instance is independently locking a different message to process, and hence the messages are not duplicating between them.

{{< img src="12.png" alt="Worker dynos processing the queue messages" >}}

Instead of the intentional delay, you can try adding an actual operation to your application and store the result of processing in a persistent data store. You can also try to add a front end to the application that submits messages to the Service Bus, which will convert this simple background job to a complete application.

## Conclusion

This article presented you with the procedure to integrate Azure Service Bus queues with Heroku worker process to build an event-driven background job. Background services are a critical component of event driven architecture which enables building microservices that are decoupled and iterate independently. Since messages placed on the Azure Service Bus are immutable, they can be treated as the source of truth of business events that can be audited.

{{< subscribe >}}
