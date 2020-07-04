---
title: "Patterns for Asynchronous Services: Buffer Fill Pattern"
date: 2016-11-17
tags:
  - cloud-patterns
---

Most of the times when working on distributed systems that involve asynchronous communication, you need to solve certain common problems. In this multi-part series, I would walk you through some common design challenges and their solutions backed with sample code that you can refer to while working on your projects.

## Buffer Fill Pattern

#### Example Scenario

This pattern comes in handy in systems where a module is responsible for collecting data from multiple sources and forwarding the collated data in batches to some other module for processing. For example, consider a webjob that needs to aggregate data from multiple data sources and store it in table storage\SQL storage by making a request to the data storage service. To elaborate on this example, let us assume there are three data sources named DS1, DS2 and DS3 whose query response times are 10 seconds, 20 seconds and 30 seconds respectively. Let us assume that the data storage service can handle a batch of 50 records to insert in the underlying data store in a single request. Being pro-developers, we will use parallelism to retrieve the entire data from all data sources in a total of 30 seconds. But most of us would next split the retrieved data in batches of 50 records and then start uploading each batch by making multiple service calls in parallel.

There are several drawbacks in the described way of processing records. First, the entire data set becomes available only after 30 seconds because of the performance of the slowest system, DS3. Next, the data split operation is memory intensive and sequential. Finally, since the data is moved to the data storage service in parallel, you may encounter service throttling issues or latencies because the storage service may not have enough resources to cater to bursts of requests.

The above problem can be easily solved by implementing the buffer fill algorithm. To realize the pattern in the above example, a shared buffer capable of storing 50 records will keep collecting data from all the data request threads and soon as it gets filled, it will transfer its contents to the data storage service. Using this pattern, we can eliminate all sequential processing steps and also optimally utilize all the systems.

#### Solution

This pattern is a major performance booster in distributed systems. The most elegant way to implement the buffer fill algorithm is by using [TPL Data Flow](<https://msdn.microsoft.com/en-us/library/hh228603(v=vs.110).aspx>). TPL Data Flow is a library made up of specialized blocks which abstract threading based implementations and model them as actor based implementations. To implement this scenario, create a buffer block of a specific size and specify an action that gets executed as soon as the buffer gets filled. Since this whole component works in asynchronous fashion, the producer thread won't get blocked throughout the program execution. Attaching a cancellation token with the flow, gives you complete control over how this block gets executed.

#### Source Code

You can download the source code of the implementation from my GitHub repository here.
{{< sourceCode src="https://github.com/rahulrai-in/BufferFillPattern" >}}

#### Executing the Sample

The test execution creates a buffer that can store five elements, which is the first argument of the constructor of the `SynchronusBatchBuffer` class. The second argument specifies the action to execute when the buffer gets filled to its capacity. This action must expect a list of data as input, as the contents of the buffer will be transferred to this function as an argument.

```CS
using (var batchBuffer = new SynchronousBatchBuffer<int>(
    5,
    elementBatch =>
        {
            foreach (var element in elementBatch)
            {
                Console.WriteLine("Got Value:" + element);
            }
        }))
{
    ...
}
```

The test execution sends integers from 0 to 38 in parallel to the buffer after adding an artificial delay to simulate real life scenarios in which data may be fed to buffer at any point of time. The action keeps printing values as soon as buffer gets filled.

I have personally used this pattern several times in real world performance intensive applications. Take a look again at the architecture of your system. Are you aggregating data and then processing it in batches? Make this small tweak in your application to realize immediate performance improvement.

{{< subscribe >}}
