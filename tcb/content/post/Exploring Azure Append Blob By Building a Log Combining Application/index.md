---
title: "Exploring Azure Append Blob By Building a Log Combining Application"
date: 2015-08-17
tags:
  - azure
  - storage
comment_id: dc47f9ea-5ae9-48f3-a751-08ff3ac1adc9
---

Recently I got entangled in building a survey solution for this website. I was nearly done when I decided to scrap it. For the now scrapped implementation, I stored survey templates as JSON files in [Azure Blob storage](https://azure.microsoft.com/en-in/documentation/articles/storage-dotnet-how-to-use-blobs/). That way I could design my own surveys simply by uploading a survey template. Next, I built logic in MVC to parse the JSON and build controls such as text box, radio button etc. to capture input. The response could be saved as a JSON file in [DocumentDb](http://azure.microsoft.com/en-in/services/documentdb/). Much later in the course of building this feature, I found out that it needed a lot of effort and maintainability efforts were high considering this is a blogging platform. So, I abandoned the concept and now I am working with [SurveyMonkey](https://developer.surveymonkey.com/) APIs which give me similar flexibility without eating into my Azure credits. I might submit [SurveyMonkey](https://developer.surveymonkey.com/) some code samples (we’ll see). Anyways, if you want to get the code of my earlier effort or just want to know more about it, you can get in touch with me (there’s a contact section in this site).

> September 23, 1016: I have scrapped the survey feature from this site.

I religiously follow all Azure updates. Storage team came out with [Append Blob and Files feature](https://azure.microsoft.com/blog/2015/08/10/azure-storage-release-append-blob-new-azure-file-service-features-and-client-side-encryption-ga/) recently. Also included in the announcement package was client side encryption of content which is pretty useful. Since I had to anyways update my site to Storage SDK 5.0, I thought I should as well build something with [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx). According to definition available on site, an append blob is comprised of blocks and is optimized for append operations. When you modify an append blob, blocks are added to the end of the blob only, via the [Append Block](https://msdn.microsoft.com/en-us/library/azure/mt427365.aspx) operation. Updating or deleting of existing blocks is not supported. Unlike a block blob, an append blob does not expose its block IDs. Each block in an append blob can be a different size, up to a maximum of 4 MB, and an append blob can include up to 50,000 blocks. The maximum size of an append blob is therefore slightly more than 195 GB (4 MB X 50,000 blocks).

[Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) has been demonstrated as a helpful feature to create log files. However, it can also address complex scenarios such as concatenating blobs to create a larger blob without the client having to upload a huge file post appending content of all the blobs. Let’s build a useful tool using this concept and features of [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx).

## Objective of Sample

The objective of building this tool is to collect log files and combine them. For instance, if you want to combine log files generated in the last ten days (which you have stored as blobs in [Azure Storage](https://azure.microsoft.com/en-in/documentation/articles/storage-dotnet-how-to-use-blobs/)) or combine a few log files, you can just provide the names of log files to combine and you would get a bigger combined log file that you can use. You would generally find it easier to search for log messages within a file than within N files. Since this is a sample application, so I would be generating and storing sample data, but you should be able to extend the application and use it as suited to your needs.

## How To Make It Work

First, download the sample from here.

{{< sourceCode src="https://github.com/rahulrai-in/appendblobazure" >}}

Now, load the downloaded solution in your Visual Studio IDE. Note that I have used C# 6, .net 4 and Storage SDK 5.0 to build this sample, which is a console application, so be wise about your environment settings. Once you have loaded the solution, you would find two projects named **AppendBlobAzureProducer** and **AppendBlobAzureConsumer**. As the name implies, **AppendBlobAzureProducer** project will produce log files in the form of [block blobs](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) and add a random log statement into it. In the meanwhile, **AppendBlobAzureConsumer** will keep reading the appended [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) file. There are two things to note here:

1.  The consumer never completely downloads the file but instead reads it from a starting offset position, therefore there is no need to download the complete file at any time.
2.  Parallel operations of both the producer and the consumer are possible because unlike block blobs, [Append Blobs](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) don’t require a commit operation to combine all blocks. [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) keeps committing the blocks as soon as they are appended to the original blob.

Once you have the solution ready, then to make it work, you would need to navigate to **App.config** files of **both** the solutions and provide [connection string](https://azure.microsoft.com/en-us/documentation/articles/storage-configure-connection-string/) of your Azure Storage Account in the value field corresponding to **StorageConnectionString** key.

1. Although you can execute the projects in any order, you should Execute the **AppendBlobAzureConsumer** project first to make it wait for the [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) to come into existence.
2. Next, execute **AppendBlobAzureProducer** project to make it start producing random log files.

The code to produce [block blobs](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) of random log files is self explanatory. Next, the following code in **AppendBlobAzureProducer** will start appending block blob content to an [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) named “append-blob.log”. If you want, you may extend the sample and choose the log files that you want to combine.

```c#
var appendBlob = container.GetAppendBlobReference("append-blob.log");
appendBlob.CreateOrReplace();

//// Now we will download each file and append it.
for (var i = 0; i < 10; i++)
{
    var logBlob = container.GetBlockBlobReference($"Log{i}.log");
    appendBlob.AppendText(logBlob.DownloadText());
    Console.WriteLine($"Appended blob Log{i}.log");
    Thread.Sleep(TimeSpan.FromSeconds(5));
}
```

I am making the code sleep for some time so that you can observe the consumer consuming the content of newly generated “append-blob.log” file in parallel to the above operation. As **AppendBlobAzureProducer** keeps appending the log file, **AppendBlobAzureConsumer** keeps using the following code loop to read content from the updated “append-blob.log” file and save the offset position in a variable to mark the position to which it has already processed the log file.

```c#
long streamStart = 0;
while (true)
{
   appendBlob.FetchAttributes();
   var availableLength = appendBlob.Properties.Length;
   if (streamStart < availableLength)
   {
       var memoryStream = new MemoryStream();
       appendBlob.DownloadRangeToStream(memoryStream, streamStart, null);
       var length = memoryStream.Length;
       memoryStream.Position = 0;
       using (var reader = new StreamReader(memoryStream))
       {
           Console.Write(reader.ReadToEnd());
       }

       streamStart = streamStart + length;
   }

   Thread.Sleep(TimeSpan.FromSeconds(2));
}
```

In a nutshell, the above block of code reads the content of blob starting from index zero to the length of the blob. It will then move its offset position by the length of Append Blob and again read the updated [Append Blob](https://msdn.microsoft.com/en-us/library/azure/ee691964.aspx) starting from that location to the length of the blob. Since the blob will keep growing in size, this process will continue until the producer has appended all the log files. Following is a screenshot of the Producer (left) and consumer (right) in action.

{{< img src="1.png" alt="Append Blob Producer and Consumer" >}}

In the end you will have an aggregated log file in your storage account container which you can download and use.

{{< img src="2.png" alt="alllogfiles" >}}

Happy Coding!
{{< subscribe >}}
