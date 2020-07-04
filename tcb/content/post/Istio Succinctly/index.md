---
title: "Istio Succinctly"
date: 2020-04-21
tags:
  - kubernetes
  - service-mesh
---
I am super happy to announce the release of my new eBook: [Istio Succictly](https://www.syncfusion.com/ebooks/istio-succinctly), published by Syncfusion. You can grab a copy of the book for free by [clicking this link](https://www.syncfusion.com/ebooks/istio-succinctly). If you are familiar with Kubernetes and want to augment your Kubernetes clusters with the most popular Service Mesh implementation, Istio, then this book is for you. In Istio Succinctly, we have tried to comprehensively cover the quintessence of Istio without sacrificing the necessary concepts and theory behind it.

{{< img src="1.png" alt="Istio SuccinctlyIstio Succinctly" >}}

My other title with Syncfusion on Kubernetes, [Kubernetes Succinctly](https://www.syncfusion.com/ebooks/kubernetes-succinctly), was recently awarded one of the most loved books by the readers of the Succinctly series by Syncfusion.

{{< img src="2.png" alt="Kubernetes Succinctly Bronze Award" >}}

I am grateful and glad that the community reciprocated the effort that went into authoring the book. Thank you.

## The Story

My friend and former colleague from Microsoft, [Tarun Pabbi](https://www.tarunpabbi.com/), and I have been working with Service Meshes since 2018. We both felt that the content available on the internet to learn Service Mesh and more so, the most popular of the lot, Istio, is not very concise and user friendly.

In July 2019, we approached [Syncfusion](https://www.syncfusion.com/) to discuss whether they would like to work with us to publish a short title on Istio. Syncfusion graciously agreed to work with us again and chip in their creatives to bring up the book. After settling the formalities, Tarun and I started the process of documenting our collective knowledge of Istio.

The biggest challenge of authoring Istio Succinctly was to layout the contents in such a manner that they do not leave gaps in understanding of concepts of Istio and do not overwhelm the reader. The initial draft of the book went over 200 pages because initially, we decided not to hold ourselves back with limits on the length of the title.

With a draft of ten chapters authored over three months, we sat through a series of Skype calls to discuss each chapter that we wrote for an hour. We discussed the importance of each section and each paragraph to the end reader and ruthlessly edited and prepared the review draft of just under 150 pages in length. We sent this draft to some of our colleagues who were willing to sacrifice their weekends to read a set of disheveled documents and providing feedback.

After a couple of weeks, we received constructive and encouraging feedback from our reviewers. We worked on every single piece of advice and built the final draft that was ready for copyediting and proofreading by the Syncfusion team. A few months and a few interactions later, the Syncfusion team launched the book in both online and offline formats.

## The Book

If you are familiar with Kubernetes and aspire to learn and bring Istio to the fold, this is the book for you. Istio Succinctly is a practical guide and focusses on learning by doing. Following is a brief outline of the chapters in the book.

1. **Service Mesh and Istio**: Introduces readers to service mesh and the planes that make up a service mesh. This chapter also describes the architecture of Istio and the role that each component plays in the architecture.

2. **Installation**: Walks the reader through the steps required for installing Istio on a local and a multi-node cluster.

3. **Envoy Proxy**: Guides the reader through deploying a simple application to the mesh in both greenfield and brownfield scenarios.

4. **Traffic Management Part 1**: Discusses the service entry and the destination rule API, which are the most important and frequently used APIs of Istio.

5. **Traffic Management Part 2**: Discusses the rest of the Istio APIs, such as the virtual service API, and the gateway API. It also presents the various patterns that can be implemented using Istio APIs to resolve different traffic management challenges.

6. **Mixer Policies**: Demonstrates the use and implementation of Mixer policies by adding a Mixer policy to the demo application.

7. **Security**: Discusses the authentication and authorization policies supported by Istio and how to incrementally add authentication and authorization policies to a cluster running services on and off the mesh.

8. **Observability**: Demonstrates how Istio supports the three pillars of observability viz. metrics, traces, and logs.

9. **Next Steps**: Discusses some advanced concepts and scenarios involving Istio, such as the SMI initiative. This chapter concludes the learning journey by presenting a plan to carry the learning journey forward.

I hope you enjoy reading the book. I look forward to receiving your feedback on Twitter or email.

{{< subscribe >}}
