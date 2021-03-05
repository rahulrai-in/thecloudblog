---
title: Implementing Multi Session Sequential Convoy Pattern with Azure Service Bus and Go
date: 2021-01-02
tags:
  - azure
  - integration
  - programming
comment_id: 74cb486b-a765-487e-8de4-eabf2827cb8d
---

In many event-driven applications, preserving the sequence of events is essential. For example, an event-driven eCommerce application might have the following states, transitions, and events.

1. A user adds N items to the basket. This action generates the _item added_ event.
2. The user checks out the basket. This action generates the _basket checked out_ event.
3. The user pays for the items. This action generates the _payment made_ event.
4. Inventory decrements the count of available items by N. This action generates the _inventory updated_ event.

For such an application to function correctly, it is critical to maintain the sequence of events. For instance, processing the _payment made_ event before the _basket checked out_ event might lead to errors in billing or inventory systems. In a horizontally scalable system, we can not guarantee sequential processing of messages without creating groups of messages so that the service bus always delivers the messages within a group in sequence. The message consumer must finish processing a message and update the status of the message to the service bus before the next message in the sequence is delivered to it. Azure Service Bus supports the concept of the grouping of related messages through the [message sessions](https://docs.microsoft.com/en-us/azure/service-bus-messaging/message-sessions) feature.

Processing a set of related messages in the First In First Out (FIFO) order is documented as a pattern named the [Sequential Convoy pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/sequential-convoy) in the Azure architecture pattern guide. I encourage you to familiarize yourself with the pattern's details, including the use cases, to ensure that the architecture pattern is a good fit for your scenario.

## Multi Session Sequential Convoy

Using Azure Service Bus sessions, you can group related messages so that the message consumer locks a session and processes messages in the session one at a time. Processing messages in a session requires the message consumer to know when to close the session. When the consumer receives the last message of the session from the Service Bus, it closes the session and moves on to process messages of another session. There are a few approaches that you can consider to define the last message of the session so that the client can instantly identify it when it arrives.

1. Producer and consumer agree on the name of the last event/message that the producer will specify either as a message property or in the message body.
2. The producer uses a custom message property to inform the consumer that the message is the last one in the session.

As you can imagine, establishing such contracts makes the producer and consumer somewhat inflexible. Any change that extends the end of the session will require changes in the contracts and the consumer. Let's solve this problem.

In most cases, our only requirement is that the messages in a session must be processed in sequence irrespective of the consumer instance that processes it. If we do not attach a consumer instance to a session, we can fix the session termination problem by adding a processing timeout period to the consumer. Following is how this approach will work.

1. The consumer locks any available session on the Service Bus.
2. The consumer records the system time when it receives a message from the session in a local timestamp variable and starts processing the message.
3. An asynchronous routine in the consumer periodically reads the latest timestamp value and closes the session if it determines that the consumer has been idle for some time.
4. The consumer again attempts to lock any available session on the Service Bus and reiterates the workflow.

What if the producer adds more messages to the session after the session is closed by a consumer instance? In that case, another consumer instance will receive and process them when it is available.

Azure Service Bus has a [Golang SDK](https://github.com/Azure/azure-service-bus-go), which I will use to implement the pattern. Feel free to use the concept to implement the pattern using any [supported Azure SDK programming languages](https://azure.microsoft.com/en-us/downloads/). Note that Azure Functions already [implement this pattern](https://dev.to/azure/ordered-queue-processing-in-azure-functions-4h6c), so use the built-in Service Bus bindings for processing session messages in Functions.

## Create Azure Resources

We need a [Service Bus namespace and a queue](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-messaging-overview) in the namespace for this demo. You can either use the [Azure management portal](https://docs.microsoft.com/en-us/azure/service-bus-messaging/service-bus-quickstart-portal) or use the following [Azure CLI commands](https://docs.microsoft.com/en-us/cli/azure/servicebus) to create the resources. Note that only the standard and premium tiers of Service Bus support sessions. If you plan to use the Azure management portal for provisioning the resources, remember to set the [**Enable Sessions** flag](https://docs.microsoft.com/en-us/azure/service-bus-messaging/message-sessions) in the list of options to create the queue.

We will create a resource group named _myresourcegroup_, a Service Bus namespace named _rahulr_, and a queue named _SessionQ_ with the following commands.

```cmd
az group create -l westus -n myresourcegroup
az servicebus namespace create --resource-group myresourcegroup --name rahulr --location westus --sku Standard
az servicebus queue create --resource-group myresourcegroup --namespace-name rahulr --name SessionQ --enable-session true
```

Record the connection string of the namespace that you created. Let's now develop the application that reads messages from the session aware queue- **SessionQ**.

## Source Code

Please download the source code of the sample application from my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/sequential-convoy-go" >}}

To keep the discussion focussed, I will explain the critical portions of the application, which will help you understand the code and customize it as per your needs.

## Application Logic

Let’s begin developing the application’s logic. We previously discussed the approach that we will take at a high level. Usually, I like writing the pseudocode of a complex implementation before writing the actual code. Please read the pseudocode of the application logic that we will implement next.

```text {linenos=inline}
Start ticker that that ticks every 10 seconds.

FOR
  Try to acquire lock on any available session
  IF Lock acquired on a session
    Attach message handler to the session
    Record message last processed time
    FOR ASYNC
      Wait for scheduled tick from the ticker
      IF message last processed time + 30 seconds > time now
        Close the current session
      ENDIF
    ENDFOR
  ELSE
    IF Lock is not acquired on a session because the operation timed out
      CONTINUE
    ELSE
      THROW error and stop the application
    ENDIF
  ENDIF
ENDFOR
```

For processing messages in a session, all Service Bus SDKs support an asynchronous handler based model. When a message on a session that is locked by the consumer is received, the `Handle` method is invoked to process the message. In our case, the message handler records the time when it received the message so that the asynchronous routine can determine whether the handler is actively processing messages.

## Implementation

Let's begin with installing the packages used by the sample application, which is a Go module. The application uses the following dependencies that you can install with the `go get` command.

1. Azure Service Bus SDK: github.com/Azure/azure-service-bus-go
2. GoDotEnv to load environment variables from a .env file: github.com/joho/godotenv

Alternatively, you can download the source code and execute the command `go mod download` to install the packages used by the module.

I used the Message Session example in the [official documentation of the Azure Service Bus Go package](https://godoc.org/github.com/Azure/azure-service-bus-go#example-package--MessageSessions) as the base of the application. I removed several features from the sample, such as the message sender and the queue creation operation, to keep the implementation concise. In the `main` method, you will find the following implementation of the pseudocode that we discussed previously.

```golang
timer := time.NewTicker(time.Second * 10)
defer timer.Stop()

for {
  // Argument value `nil` receives messages from any available session.
  // You can pass reference to a session id to receive messages from that session.
  qs := q.NewSession(nil)
  sess := &StepSessionHandler{
    lastProcessedAt: time.Now(),
  }

  // Recurring routine to check whether message handler is processing messages in session.
  go func() {
    for {
      now := <-timer.C
      if sess.messageSession == nil {
        fmt.Printf("❗ Waiting to start new session at %v\n", now)
        continue
      }

      fmt.Printf("# Checking timestamp of the last processed message in session at %v\n", now)
      if sess.lastProcessedAt.Add(time.Second * 30).Before(time.Now()) {
        fmt.Println("❌ Session expired. Closing it now.")
        sess.messageSession.Close()
        return
      }

      fmt.Println("✔ Session is active.")
    }
  }()

  if err = qs.ReceiveOne(ctx, sess); err != nil {
    if innerErr, ok := err.(*amqp.Error); ok && innerErr.Condition == "com.microsoft:timeout" {
      fmt.Println("➰ Timeout waiting for messages. Entering next loop.")
      continue
    }

    fmt.Println(err)
    return
  }

  if err = qs.Close(ctx); err != nil {
    fmt.Println(err)
    return
  }
}
```

Following is the declaration of the struct `StepSessionHandler` that implements the interface `SessionHandler`. The `SessionHandler` interface defines the methods `Start` `End` and `Handle`. Note that the `lastProcessedAt` field is referenced by two asynchronous processes, which might lead to the concurrent read/write problem. The concurrent read/write problem occurs when one thread is writing to a variable while another variable is concurrently reading from that same variable. The [RWMutex](https://golang.org/pkg/sync/) is a reader/writer mutual exclusion lock that helps set up a lock between readers and writers. We will use the mutex to prevent concurrent read and write operations on the variable.

```golang
type StepSessionHandler struct {
	sync.RWMutex
	lastProcessedAt time.Time
	messageSession  *servicebus.MessageSession
}

// Read last processed time in thread safe manner
func (sh *StepSessionHandler) GetLastProcessedAt() time.Time {
	sh.RLock()
	sh.RUnlock()
	return sh.lastProcessedAt
}

// Write last processed time in thread safe manner
func (sh *StepSessionHandler) SetLastProcessedAt(timestamp time.Time) {
	sh.Lock()
	sh.lastProcessedAt = timestamp
	sh.Unlock()
}

// End is called when a session is terminated
func (sh *StepSessionHandler) End() {
	fmt.Println("End session")
}

// Start is called when a new session is started
func (sh *StepSessionHandler) Start(ms *servicebus.MessageSession) error {
	sh.messageSession = ms
	fmt.Println("Begin session")
	return nil
}

// Handle is called when a new session message is received
func (sh *StepSessionHandler) Handle(ctx context.Context, msg *servicebus.Message) error {
	sh.SetLastProcessedAt(time.Now())
	fmt.Printf("  Session: %s Data: %s\n", *msg.SessionID, string(msg.Data))

	// Processing of message simulated through delay
	time.Sleep(5 * time.Second)

	return msg.Complete(ctx)
}
```

Let's now prepare to run the application by setting up the configurations required by it.

## Executing the Application

Our application requires two values, the connection string of the Service Bus namespace and the name of the queue, present as environment variable values to initialize itself. Set the connection string of the Service Bus namespace that you recorded previously as the value of the `SERVICEBUS_CONNECTION_STRING` environment variable and the name of the queue as the value of the `QUEUE_NAME` environment variable. The application supports reading environment variables from a **.env** file as well. You can store the two values in the following format in a **.env** file that you can create in the application's root directory.

```env
SERVICEBUS_CONNECTION_STRING=<CONN STRING>
QUEUE_NAME=SessionQ
```

It's now time to launch the application and observe its behavior. The Azure portal has a Service Bus explorer tool that you can use to publish messages on a queue. You can read more about the capabilities of the tool on [the Azure documentation website](https://docs.microsoft.com/en-us/azure/service-bus-messaging/explorer). We will use this tool to run our tests.

## Tests

Launch the application by executing the command `go run main.go`. After initialization, the application will be ready to consume messages. Let's test the application with a few scenarios.

### Consume Messages from Single Session

In this scenario, we will send two messages to the same session ID- 1. The consumer will consume both the messages from the session as follows.

{{< video src="1.mp4" alt="Consuming messages from single session demo" >}}

### Consume Messages from Multiple Sessions

We will now send some messages to session ID 1 to process its messages. While the application is waiting for more messages in Session ID 1, we will add some messages to session ID 2 and wait for the application to close session ID 1 and begin processing messages in session ID 2.

{{< video src="2.mp4" alt="Consuming messages from multiple sessions demo" >}}

If you let the application sit idle for some time and not publish any more messages, you will notice that it will close the active session and keep trying to acquire a lock on an available session in the queue.

{{< img src="3.png" alt="Waiting for new session" >}}

## Conclusion

You can adjust the duration limits, viz. waiting for new sessions and releasing an idle session, based on your requirements. You might encounter an edge case where because the session is closed or the application terminates before you marked the message as complete, the message may reappear on the queue. For such cases, you must ensure that your application is prepared for [at-least-once processing](https://www.cloudcomputingpatterns.org/at_least_once_delivery/).

If you are hosting your worker processes in Kubernetes or Azure App Service or another cloud, then implementing the Sequential Convoy pattern with support for multiple sessions can enhance your application's throughput and ensure better utilization of the compute capacity.

{{< subscribe >}}
