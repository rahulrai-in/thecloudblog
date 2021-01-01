---
title: "Draft 28 Dec 20"
date: 2020-12-28
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

https://docs.microsoft.com/en-us/azure/architecture/patterns/sequential-convoy

Title: Processing Sequential Convoy Pattern

In several applications preserving the sequence of events is important. For example, an event based eCommerce application might have the following states, transitions, and the associated events.

1. User adds N items to basket. This action generates the event, _item added_.
2. User checks out the basket. This action generates the event, _basket checked out_.
3. User pays for the items. This action generates the event, _payment made_.
4. Inventory decrements the count of available items by N. This action generates the event, _inventory updated_.

In such an applicaton, it is critical to maintain the sequence of events so that the application works properly. For instance, processing the _payment made_ event before the _basket checked out_ event might lead to errors in billing or inventory systems. In a horizontally scalable system, we can not gurantee sequential processing of messages without the concept of grouping of messages such that messages in a group are always delivered in sequence. A consumer must finish processing a message before the next message in sequence is delivered to it. Azure Service Bus supports the concept of grouping of related messages through the [message sessions](https://docs.microsoft.com/en-us/azure/service-bus-messaging/message-sessions) feature. Processing a set of related messages in the First In First Out (FIFO) order is documented as [Sequential Convoy pattern](https://docs.microsoft.com/en-us/azure/architecture/patterns/sequential-convoy) in the Azure architecture pattern guide.

## Application Logic

We are going to follow the below logic. Here is the pseudocode of the logic

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

## Implementation

I have used the Message Session example on the [official documentation of the Azure Service Bus package](https://godoc.org/github.com/Azure/azure-service-bus-go#example-package--MessageSessions) as the starting point of the application. The solution on the Godoc website includes a method that ensure that a service bus queue exists which I have used as it is and a message sender that I have removed. Also, the sample on the documentation uses JSON messages which I have replaced with plain text messages to simplify the implementation.

Here is the implementation of the pseuodocode.

```golang
timer := time.NewTicker(time.Second * 10)
defer timer.Stop()

for {
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

  err = qs.ReceiveOne(ctx, sess)
  if err != nil {
    if innerErr, ok := err.(*amqp.Error); ok && innerErr.Condition == "com.microsoft:timeout" {
      fmt.Println("➰ Timeout waiting for messages. Entering next loop.")
      continue
    }

    fmt.Println(err)
    return
  }

  err = qs.Close(ctx)
  if err != nil {
    fmt.Println(err)
    return
  }
}
```

Let's take a look at the struct `StepSessionHandler` which implements the interface `SessionHandler`. The key methods that must be implemented are Start End and Handle.

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

## Considerations

You can adjust the time limits on the processing based on your needs. However, you might encounter an edge case where because the session is closed, or the application terminates before you marked the message as complete, the message may reappear on the queue. For such cases, you must ensure that the logic you write within the message handler is idempotent.

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
