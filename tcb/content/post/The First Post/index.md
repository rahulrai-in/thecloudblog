---
title: "The First Post"
date: 2015-07-30
tags:
  - azure
  - app service
---

Finally, my custom blogging platform is ready and raring to go. I will try to write as frequently as I can and keep making platform improvements. Since I have been working on building my blogging platform for some time, I think my opening blog should talk about how the platform works.

> September 23, 2016: I have migrated my blog to Hugo, which is a static site generator. Azure WebApps still hosts this blog. This post will help you setup your own beautiful blog using a number of Azure services.

First, the technology stack:

- [Microsoft Azure Web App](http://azure.microsoft.com/en-us/) for MVC based user interface.
- [Microsoft Azure Table Storage](https://azure.microsoft.com/en-in/documentation/articles/storage-table-design-guide/) for storing blog content.
- [Microsoft Azure Blob Storage](https://azure.microsoft.com/en-in/documentation/articles/storage-dotnet-how-to-use-blobs/) for storing some platform resources and all media content of blog.
- [Microsoft Azure Search Service](http://azure.microsoft.com/en-in/services/search/) for enabling search on the content.
- [Microsoft Azure DocumentDb](http://azure.microsoft.com/en-in/services/documentdb/) for capturing inputs from my site audience such as for Testimonials.
- [Microsoft Azure Redis Cache](http://azure.microsoft.com/en-in/services/cache/) for storing sessions and cache data.
- Analytics through [Google](http://www.google.co.in/analytics/) and [AppInsight](https://azure.microsoft.com/en-us/documentation/articles/app-insights-get-started/).
- [GitHub](https://github.com/rahulrai-in) for source control.

Before I say anything else, I would like to say that you can find the whole source code available on my [GitHub](https://github.com/rahulrai-in) account. I would use [MSDN](https://social.msdn.microsoft.com/profile/rahul.rai/) and [GitHub](https://github.com/rahulrai-in) to post samples and you are free to use them, though, I would not mind link backs and comments as tokens of appreciation :)

Another point I would like to make here is that the whole infrastructure is running on low billing tiers, so if the quota gets consumed, you might encounter error pages. I will add capacity based on resource usage and whatever my budget can support. There will never be a donate button or advertisements on this site ever.

In a nutshell, the platform works as follows:

1.  I author content using the beloved Windows Live Writer.
2.  I push the content to the blog platform, in turn the platform does the following activities for me.
    1.  It stores all the images and other media resources in Azure Blob Storage Service.
    2.  It splits the content into small chunks and stores the chunks in Azure Table Storage Service. (Why? Because an entity in table storage can’t hold more than 64 KB of binary data)
    3.  It uses Azure Search Service to index the content.
3.  You request for the content through search service or by navigating to the content.
4.  The platform pulls your requested data from the respective storage destinations.
5.  I cache certain content because querying for them repetitively is pretty expensive. You are served that content from the Azure Redis Cache.

For those who love diagrams, here is an image showing all the components.

{{< img src="1.png" alt="Infrastructure" >}}

There are other features available on the platform as well. I store all the data you supply though various forms in Azure DocumentDb. This gives me the flexibility to add\remove entities from data that I capture without writing any of those pesky DDL queries in SQL. Automatic indexing of data, flexible queries and out of the box connectivity to HDInsight though connectors are just some of the features for which I love DocumentDb. You should try it yourself to appreciate it better.

If you like a feature of the blog or want to copy a code snippet that I post in any article, feel free to do so. There are multiple ways to get in touch with me, feel free to use any. See you soon!

{{< subscribe >}}
