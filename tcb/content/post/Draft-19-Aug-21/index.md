---
title: Open Telemetry with .NET
date: 2021-08-19
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Modern software development requires iteratively delivering quality software. Agile software development practices can increase the velocity of development and enhancement of applications by the developers. However, the handoff of the application to the test team and subsequently to the operations team presents several challenges due to the lack of communication among the teams and the lack of processes and tools that can make the software delivery process efficient. By adopting the principles of DevOps, we can streamline the components of the software delivery process: continuous integration, continuous delivery, and continuous deployment.

## What is DevOps?

DevOps (**De**livery and **Op**erations) is a set of principles and tools that streamline the communication and collaboration between the development team and the operations team. With a shorter communication loop, the organization can rapidly produce software and respond quickly to the business needs. The DevOps approach to the software delivery process is based on the Agile principles in which all the teams involved in delivering the software: business owners, development, operations, and Quality Assurance work together continuously.

Organizations can remove the communication overhead between specialized teams by creating self-sufficient teams that deliver a product from concept to deployment. Next, to fully implement the DevOps process, the team should automate the delivery of the software with a delivery pipeline that acts as a single path to production for any changes to the application, including application code, database schema, and environment changes.

## What is a Delivery Pipeline?

A delivery pipeline automates the processes of integrating the changes with the application code, verification of changes through automated tests, and packaging and deployment of the application. An ideal delivery pipeline should include the following components:

1. Version control tool
2. Continuous integration (CI) process and tool
3. Continuous deployment or Automated deployment process and tool
4. Automated testing tool

A delivery pipeline should be observable so that anyone can trace any changes to the application, and anyone can monitor the status of the application in each environment (test, preproduction, production). The delivery pipeline should validate changes to the application at different stages of the delivery process through a series of automated tests. Only the changes that pass the validation criteria should be placed in the release queue for deployment to the various environments.

## What is Continuous Deployment?

Continuous Deployment aims to optimize the time-to-market of software development to the extent that every commit can be released to production with minimum effort and ideally without manual intervention. Reducing the time to production requires the combined development, testing, and operations teams to have the code that is production-ready with every change.

Releasing directly to production can be risky, and so some popular Continuous Deployment patterns have emerged that allow validating the changes safely before releasing them to users as follows:

1. **Blue/Green deployment**: This strategy requires maintaining two identical environments. In one of the environments, the live application is deployed, and on the other, the candidate application is deployed. A load balancer is used to route traffic between the two environments. Once a deployment has been approved, the load balancer can route the traffic to the new application. If any issues are detected with the latest application, the load balancer can be updated to point back to the old application.

2. **Canary deployment**: This strategy requires maintaining two different environments, just like the Blue/Green strategy. However, in this case, instead of routing all the traffic to either deployment, the load balancer is configured to route a subset of traffic to the candidate deployment. If the new service can manage the limited traffic, the load balancer will incrementally route more traffic to the deployment until 100% of the traffic is directed to it.

3. **Feature toggle**: A feature toggle allows a feature to be present in the product but not available to users until an external process signals it to be active. The developer or the operations can use the feature toggle as a “Kill switch” to disable the feature if a problem is found after the deployment.

4. **Dark launch**: This strategy requires maintaining two versions of an application, the live application, and the candidate application, in different environments. A proxy service is used to route client requests to both the applications simultaneously; however, only the response from the live application is returned to the client. The objective is to collect telemetry from the candidate application, which the developers use to determine the application’s readiness for production deployment.

Irrespective of the technique used, Continuous Deployment requires strong team discipline and architecture oversight to ensure that a release does not degrade the user experience, application utility, or overall product quality. The Continuous Deployment approach is more suitable for applications that focus on user engagement such as email, collaboration, and social media than for systems of record such as CRM, ERP, and accounting systems since the cost of errors can be vastly different between the two.

Which Continuous Deployment strategy is right for your use case? The answer depends on the culture of the organization and the context of the application. One key aspect worth noting is that the traditional software release approval process is incompatible with Continuous Delivery and Continuous Deployment. Instead, the cross-functional team, including architects, developers, testers, and operations, should decide when to release changes to production and the process to be followed.

## What is the difference between Continuous Integration and Continuous Deployment?

Continuous Integration (CI) is an automated software development process that enables developers to frequently integrate, build, and test their code. The integration executes on a Continuous Integration Build Server which executes the following steps and more:

1. Detect changes in the source code repository using tools such as [Subversion](https://subversion.apache.org/).
2. Extract the modified source code from the repository and copy it to the build server.
3. Compile the source code.
4. Validate the quality of the code and the build using code quality analysis tools and automated tests.
5. Merge the valid code into the repository using the source code repository tool.
6. Report the build status to the users.

The Continuous Deployment process takes the source code as input and carries it through a series of operations to produce a deployable artifact. A deployable artifact is a self-contained application binary that can be executed on a server. The Continuous Deployment process takes the artifact and deploys it to one or more environments. The deployment might or might not require approval from the team based on the business requirements and the organizational culture.

## What is the difference between Continuous Delivery and Continuous Deployment?

A common question that comes up when discussing Continuous Delivery and Continuous Deployment is what is the difference between the two?

Continuous Delivery enables the software team to deliver the software periodically, such as daily, weekly, fortnightly, etc. The Continuous Delivery pipeline takes the code changes, packages them into a deployable artifact, and deploys the artifact to the configured environments.

Continuous Deployment aims to takes Continuous Delivery further by optimizing the delivery processes to the extent that every change gets deployed to the production environment with minimum effort. It is an excellent practice that can help the software development team measure the impact of the change immediately and reduce the feedback loop with the customers.

Continuous Deployment requires the best Quality Assurance culture and a very high level of automation which is not always present in traditional organizations. The practice has various advantages, such as reduced time to market, reduced cost, and reduced risk. Software teams and organizations should strive towards implementing it by continuously optimizing the delivery process and reducing the delivery cycle period.

{{< subscribe >}}


NOTE for FUTURE: https://developer.chrome.com/docs/workbox/remove-buggy-service-workers/