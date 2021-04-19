---
title: "Patterns for Asynchronous Services: Producer-Consumer Pattern"
date: 2016-11-22
tags:
  - cloud-patterns
comment_id: 4c4beebd-33f3-44be-97c3-e278871d790a
---

Let's take our discussion forward to discuss the [Producer and Consumer problem](https://en.wikipedia.org/wiki/Producer%E2%80%93consumer_problem). According to the definition, the problem describes two processes, the producer and the consumer, who share a common, fixed-size buffer used as a queue. The producer's job is to generate data, put it into the buffer, and start again. At the same time, the consumer is consuming the data (i.e., removing it from the buffer), one record at a time. The problem is to make sure that the producer won't try to add data into the buffer if it's full and that the consumer won't try to remove data from an empty buffer.

## Producer-Consumer Pattern

#### Example Scenario

This is one of the most common patterns that most of us have implemented in our own unique ways. Consider a service\web job instance that keeps retrieving data from a shared resource e.g. a database and feed it to a process that processes the data one record at a time. The buffer used to synchronize messages between producer and consumer should do so in a FIFO manner.

#### Scenario

You can implement this pattern in multiple scenarios such as:

1. A web job instance retrieves data from storage and processes it.
2. A web job instance that produces data at recurring intervals and processes it.
3. Other P\C problems.

#### Solution

Using [TPL Data Flow](<https://msdn.microsoft.com/en-us/library/hh228603(v=vs.110).aspx>), this scenario can be realized in the easiest manner. We will use a [Buffer Block](https://msdn.microsoft.com/en-us/library/hh228603(v=vs.110).aspx#Predefined Dataflow Block Types) which contains the data that needs to be sent from the producer to the consumer. We would need to assign this buffer to both the producer and the consumer functions to keep them synchronized.

```c#
private static void TestProducerConsumerFunction()
{
    var sharedPayload = new BufferBlock<IList<int>>();
    WorkTaskComposer(sharedPayload);
    AsynchronousConsumer(sharedPayload);
}
```

Next, the producer will run recursively and post data to this buffer.

```c#
private static async void WorkTaskComposer(ITargetBlock<IList<int>> targetBlock)
{
    await Task.Factory.StartNew(
        () =>
            {
                var randomInteger = new Random();
                while (true)
                {
                    var list = new List<int>();

                    ////Do some work here to produce work for consumer.
                    Thread.Sleep(TimeSpan.FromSeconds(5));
                    for (var generatorCounter = 0; generatorCounter < 4; generatorCounter++)
                    {
                        var value = randomInteger.Next(0, 100000);
                        Console.WriteLine("Producer Produced: " + value);
                        list.Add(value);
                    }

                    targetBlock.Post(list);
                }
            });
}
```

The consumer consumes the data asynchronusly. As soon as data becomes available in the buffer, the consumer function starts working on it.

```c#
private static async void AsynchronousConsumer(ISourceBlock<IList<int>> sourceBlock)
{
    while (await sourceBlock.OutputAvailableAsync())
    {
        var producedResult = sourceBlock.Receive();
        foreach (var result in producedResult)
        {
            Console.WriteLine("Receiver Received:" + result);
        }
    }
}
```

#### Source Code

You can download the source code of the implementation from my GitHub repository here.
{{< sourceCode src="https://github.com/rahulrai-in/ProducerConsumerPattern" >}}

#### Executing the Sample

Simply run the sample that you downloaded from the repository. The producer in the program will keep generating random numbers and feeding them to the buffer. The consumer will wait for data to become available and it will process the data in the buffer.

#### Conclusion

With this pattern, I would like to conclude the ongoing patterns series. I would keep writing about cloud design patterns from time to time to help you get past some of the common design hurdles that you may face during solution development.

{{< subscribe >}}
