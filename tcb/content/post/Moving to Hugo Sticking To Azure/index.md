---
title: "Moving to Hugo Sticking to Azure"
date: 2016-10-04
tags:
  - azure
  - app service
comment_id: 7929d4c4-d53c-44e8-b941-a26c85ab317f
---

I recently completed the migration of [my blog](/post/the-first-post) to a brand new platform. I primarily went through the upgrade process to remove dependency on [Windows Live Writer](https://en.wikipedia.org/wiki/Windows_Live_Writer) to author content and to trim down the large number of Azure services that I was using to keep the blog ticking. Of course, I wanted to improve the response time and keep my focus on writing posts and not maintaining the code base. Thus, the switch to static website generators...

## What Are Static Website Generators?

Simply put, static website generators take your content, which is typically stored in flat files rather than databases, apply it against layouts or templates and generate a structure of purely static HTML files that are ready to be delivered to the users. Since there is no server-side script running on the host, there is no processing time involved at all to respond to requests. Several large corporations such as Google ([Year in Search](https://www.google.com/trends/)), Nest and MailChimp use static website generators to deliver content. Currently, there are more than 100 [static website generators](https://staticsitegenerators.net/) that you can choose from. Most notably, the [Jekyll](https://jekyllrb.com/) generator that powers the US healthcare website [Healthcare.gov](https://developmentseed.org/blog/new-healthcare-gov-is-open-and-cms-free/) and the [Obama presidential campaign website](http://kylerush.net/blog/meet-the-obama-campaigns-250-million-fundraising-platform/).

Of course, the static website approach has drawbacks. The biggest one being that the content can not interact with the users. Any personalization and interactivity has to run on the client side, which is restricted. There is no admin interface that you can use to author content such as those available in most of the modern-day CMS such as [Umbraco](https://umbraco.com/). However, this blog or most websites on the internet serve the only purpose of displaying information to the user and therefore do not need a server-side code. I prefer staying within the realms of Visual Studio as much as possible and therefore, the admin interface is not a show stopper issue for me.

## This Blog Runs on Hugo

There are several generators to choose from and most of the bloggers stick with [Jekyll](https://jekyllrb.com/) and [Middleman](https://middlemanapp.com/) for good reasons. I chose [Hugo](https://gohugo.io/) primarily because it can generate websites at lightning speeds and because it is incredibly simple to set up. Unlike Ruby and Node.js which require setting up the development environment, Hugo only requires you to copy the binaries to a location. If you want to update Hugo, just copy the new binaries at the location. There is [no parallel to speed](https://ludovic.chabant.com/devblog/2015/07/12/multi-core-piecrust-2/) of generating websites with Hugo. The content generation speed is essential during development, when you have to generate the site multiple times, and when staging the site before pushing the content to production. The content is only growing to increase in size later and with some foresight you can avoid sitting idle, twiddling your thumbs and waiting for your site to get generated to see your content go live.

The biggest drawback of Hugo is that you can't hack into the asset pipeline to include tools such as [Grunt](http://gruntjs.com/) or [Gulp](http://gulpjs.com/). All you have is a `static` folder which contains scripts and stylesheets that you can use in your website. You can create a build script that includes Hugo as part of build process to use features of Sass, ES etc.

However, Hugo has no dependencies and the best content model. You can put content in the predefined folder format and Hugo will parse it as sections and as entries in those sections. Features such as [live-reload](https://gohugo.io/extras/livereload/) reduce the development time and are a joy to work with.

## The New Architecture

After the revamp, the new architecture is as follows:

{{< img src="1.png" alt="The New Architecture" >}}

You will notice that I use a far fewer components and that I have included [Travis CI](https://travis-ci.org/) and [Azure CDN](https://azure.microsoft.com/en-us/services/cdn/) in the delivery pipeline.

Travis CI is a third-party hosted CI and CD service that is free for open source GitHub projects. Travis is highly customizable. You can hack into the build pipeline by supplying scripts to execute during the various stages of the build process.

Once Travis CI has been activated for a given repository, GitHub will notify it whenever new commits are pushed to that repository or when a pull request is submitted. It can also be configured to only run for specific branches, or branches whose names match a specific pattern. Travis CI will then check out the relevant branch and run the commands specified in `.travis.yml`, which usually build the software and run any automated tests. When that process has completed, Travis notifies the developers in the way it has been configured to do so, such as, by sending an email containing the test results.

The new design uses a couple of Azure components such as [WebApps](https://azure.microsoft.com/en-us/documentation/articles/app-service-web-overview/), [Scheduled Jobs](https://azure.microsoft.com/en-us/documentation/articles/scheduler-get-started-portal/), [Web Jobs](https://azure.microsoft.com/en-us/documentation/articles/web-sites-create-web-jobs/), [Azure CDN](https://azure.microsoft.com/en-us/services/cdn/) and a couple of external dependencies. You must already be familiar with the Azure Services (if not, [subscribe](#subscribe)). Next, let's take a look at the working of the system.

## The Process

I write my blogs in [Markdown](https://en.wikipedia.org/wiki/Markdown) and save the supporting images in a local folder which is mapped to [OneDrive](https://onedrive.live.com/about/en-us/). I then sync the images to Azure Blob Storage using [Cloudberry](http://www.cloudberrylab.com/free-microsoft-azure-explorer.aspx). An Azure CDN instance picks up the images and resources from the blob storage and pushes them to CDN PoP (points of presence) ([see how](https://azure.microsoft.com/en-us/documentation/articles/cdn-create-new-endpoint/)). A WebJob detects that images have been uploaded to the storage account ([see how](https://azure.microsoft.com/en-us/documentation/articles/websites-dotnet-webjobs-sdk-storage-blobs-how-to/)). The WebJob then downloads those images, optimizes them, pushes them back to the storage and purges the appropriate CDN endpoint so that the optimized content becomes available for delivery by the CDN.

Next, I push my blog post to GitHub from where Travis is notified of the changes. I use a [custom script](https://github.com/rahulrai-in/Blog-Web/blob/master/travisdeploy.sh) to git push only the new or updated files to my Azure WebApp. This saves me from the pain of deploying everything to my WebApp on every single push. Also, Hugo does not, by default, build the posts that are marked as `draft`, which helps me push my in-progress blog posts to GitHub without affecting the existing deployment. Later on, when I am ready, I just need to set the `draft` property of the post to **false** to make the post public.

I have integrated a third-party mailing system to the blog that detects the changes in the [RSS feed](/post/index.xml) of this blog and sends an email to my subscribers. I took great pains to make sure that the data of my subscribers stay safe. I :heart: my subscribers and therefore, I pay :moneybag: [MailerLite](https://www.mailerlite.com/) to keep my subscriber list safe and to keep my subscribers happy.

## The Code

As always, the code is available for you to use in your projects or blogs for **FREE**. Do send me a note of appreciation if it did help you.{{< sourceCode src="https://github.com/rahulrai-in/Blog-Web" >}}

## Improving Efficiency

Several factors make this blog efficient at delivery:

1. No use of server-side script.
2. Optimization of all images to reduce delivery payload.
3. Integration of [Gulp](https://github.com/gulpjs/gulp/blob/master/docs/getting-started.md) to build pipeline to compress generated HTML and scripts.
4. Delivery of resources through Azure CDN.
5. Keeping the WebApp always loaded through [Always On](https://azure.microsoft.com/en-us/documentation/articles/web-sites-configure/) setting.
6. Replacing Google Analytics (heavy script) with [Heap Analytics](https://heapanalytics.com/compare/heap-vs-google-analytics) ([light](https://heapanalytics.com/features/data-capture) and more fun).

## Conclusion

This blog survives on feedback. People report issues to me all the time, and that's what makes it better. Do subscribe and let me know your opinion.

Even more important for me is to see that you set up your own blog and curate it. If you don't want to go through the hassle of hosting one of your own blogging platforms, start with a free hosted platform out of the [several ones you can choose from](http://www.creativebloq.com/web-design/best-blogging-platforms-121413634), and post whatever comes to your mind. Not only will it keep you happy, it will give you a brand name of your own. Take care!

{{< subscribe >}}
