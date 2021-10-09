---
title: Continuos Delivery
date: 2021-10-03
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Continuous Integration, Continuous Delivery, and Continuous Deployment are different processes that can significantly increase the velocity of product development and release cycles. This article will discuss each of the three processes, the tooling available to implement them, and how they aid the implementation of DevOps.

Let's start with understanding the term "Continuous", which is common across the three processes. In the context of software development, Continuous implies that a code change pushed to the source control can proceed without human intervention (except approvals) through the stages of build, test, package, and deployment. The stages form a pipeline that takes the application source code and turns it into a deployable artifact. Several popular names for this pipeline include Continuous Delivery pipeline, deployment pipeline, and release pipeline. The transitions between the stages should be automated, and human interventions should be required in the following cases only:

1. To validate and authorize something before the artifact progresses to the next stage, e.g., a code review before the packaging or user acceptance test before deployment.
2. To recover from errors caused by the application.
3. To recover from failures of any stage in the pipeline.

Let's now expound on each of the three processes.

## Continuous Integration

In the Continuous Integration (CI) phase, the code changes from multiple contributors are merged into a single project and tested. The CI phase aims to ensure that the code changes do not introduce errors to the application.

The CI phase begins with writing and executing targeted tests that validate the correctness of the code called unit tests. Unit tests should not depend on any external resources such as external services or databases. As developers have an intrinsic understanding of the code, they are responsible for writing the unit tests.

After developing the application code and unit tests, the developer pushes them to the source control repository. The source control repository is usually a version control system (VCS) such as [Git](https://git-scm.com/). If the code conflicts with existing code in the repository, the developer must manually fix the conflicts and push the changes to the code repository.

Next, the VCS notifies a CI tool such as [Jenkins](https://jenkins.io/index.html) or [Travis CI](https://travis-ci.org/) of the code changes. The CI tool then pulls the latest code from the repository and attempt to build it and run the unit tests. If a VCS does not support sending push notifications to CI tools, the CI tool can be configured to poll the repository for changes.

An optional step you can include in the workflow is to run the code through a code review process before it is pushed to the code repository. Tools such as [Gerrit](https://www.gerritcodereview.com/) use webhooks to intercept code push to a remote Git repository and wait for a code review to be completed.

Popular hosted Git repositories such as [GitHub](https://github.com/), [GitLab]
(https://gitlab.com/), and [Bitbucket](https://bitbucket.org/) use a different model to incorporate code reviews. Anyone who wants to contribute to a repository can copy the repository in their userspace (called a fork). They can then make the desired changes to the code and submit a pull request to merge the fork into the main repository. The pull request signals the maintainers of the main repository that they should review the changes and merge them into the main repository. Pull requests can be configured to trigger automatic checks such as successful builds and execution of tests to ensure that changes will not break the existing code base.

## Continuous Delivery

Continuous Delivery is the chain of processes that takes the application source code and runs it through build, test, packaging, and related operations to produce a deployable artifact. The goal of the CD phase is to ensure that the application is ready for deployment without much (ideally any) human intervention.

The Continuous Delivery pipeline takes the code changes pulled in by the CI system and takes them through a sequence of processes to produce a deployable artifact. An artifact is either a deliverable such as packaged binary of an application or part of a deliverable such as a compressed file containing other files. After producing the artifact, the delivery pipeline can trigger a Continuous Deployment (CD) process to deploy the artifact to the target environment.

A key activity of the CD pipeline is to combine the code that it received from the CI system with the code that it is dependent upon and produce a new version of the application and hence a new version of the deployable artifact. Versioning is a critical component of the delivery pipeline and usually follows a versioning scheme such as [Semantic Versioning](https://semver.org/). Versioned artifacts are stored and managed by artifact repository tools such as [Artifactory](https://www.jfrog.com/artifactory).

An automated suite of tests can be executed on the application as part of the delivery pipeline to verify whether the application is fit for deployment as follows:

1. Integration tests to verify whether the application works when combined with other services and components.
2. Functional tests to verify whether the result of executing functions in the application is as expected.
3. Acceptance tests to verify whether the application meets the non-functional requirement constraints such as performance, scalability, stress, and scalability.

These types of tests can be run continuously every time the developer pushes a new code update. Note that unit tests are not part of the pipeline as they are integrated with the build process as part of the CI stage, and it is focused on testing the code in isolation.

## Continuous Deployment

Continuous Deployment aims to deploy the artifact produced by the delivery pipeline to a target environment such as a server, a web application, or a mobile application.

Although the delivery pipeline can trigger a deployment pipeline, not every artifact produced by the delivery pipeline needs to be always deployed. The delivery pipeline only guarantees that the artifact it produced is deployable. The deployment pipeline might defer the decision to deploy the artifact to critical environments such as staging and production to a human while automatically deploying the artifact to non-critical environments.

Following are a few common patterns to enable the controlled rollout of a deployment. The objectives are to ensure that the deployment is rolled back immediately in case of issues and test new functionality in a controlled manner.

1. **Blue/Green deployment**: This strategy requires maintaining two identical environments. In one of the environments, the live application is deployed, and on the other, the candidate application is deployed. A load balancer is used to route traffic between the two environments. Once a deployment has been approved, the load balancer can route the traffic to the new application. If any issues are detected with the latest application, the load balancer can be updated to point back to the old application.
2. **Canary deployment**: This strategy requires maintaining two different environments, just like the Blue/Green strategy. However, in this case, instead of routing all the traffic to either deployment, the load balancer is configured to route a subset of traffic to the candidate deployment. If the new service can manage the limited traffic, the load balancer will incrementally route more traffic to the deployment until 100% of the traffic is directed to it.
3. **Feature toggle**: A feature toggle allows a feature to be present in the product but not available to users until an external process signals it to be active. The developer or the operations can use the feature toggle as a "Kill switch" to disable the feature if a problem is found after the deployment.
4. **Dark launch**: This strategy requires maintaining two versions of an application, the live application, and the candidate application, in different environments. A proxy service is used to route client requests to both the applications simultaneously; however, only the response from the live application is returned to the client. The objective is to collect telemetry from the candidate application, which the developers use to determine the application's readiness for production deployment.

## DevOps: A Culture with Best Practices

Historically, developers were responsible for building applications but could not access the infrastructure to deploy them. The operations teams were responsible for writing the installation scripts and deploying the applications to the infrastructure they managed exclusively. The disconnect between the two teams often led to confusion and problems. The problem with the operations teams was that they were brought in the loop close to the end of the delivery cycle and made to deploy applications in customer environments in a short time frame. On the other hand, when faced with issues, the developers didn't know the environment where their applications were deployed and relied on the operations teams to provide that information.

DevOps is a set of recommended practices to reduce the friction between the development (Dev) and operations (Ops) teams and enable them to work together to build and deploy applications. The Continuous Delivery pipeline is an implementation of several DevOps best practices. A pipeline that builds, tests, packages, and deploys applications every time a code change is pushed to the repository can help the development and operations teams identify issues at any stage of the delivery cycle, from development to deployment.

The concepts of DevOps can be extended to include infrastructure by implementing Infrastructure as Code (IaC). Infrastructure as Code enables you to write configuration, setup of the tools, and the continuous delivery pipeline as code and store it in a version-controlled repository. By implementing Infrastructure as Code and processing it through a Continuous Delivery pipeline, you can automatically provision, trackable, and updatable infrastructure. Implementing IaC is much easier with programmable infrastructures such as the cloud and virtualized environments like Docker and Kubernetes than bare metal.

Containers encapsulate the runtime environment and the application process. Also, delivery pipelines can track changes to the definition file (Dockerfile) they are built from and automatically update the container when the definition file changes. However, as the number of containers increases, deploying, managing, and scaling them gets more challenging. Kubernetes is a container orchestrator that provides a declarative approach to deploying, managing, and scaling containers.

## Conclusion

The principles and tools of Continuous Integration, Continuous Delivery, and Continuous Deployment can optimize the delivery of applications to production quickly and reliably. In addition, these processes greatly simplify the works of the development and operations teams and enable them to collaborate more effectively, which is one of the core goals of the DevOps culture.

Continuous Delivery pipelines can be created to automate the deployment of applications to production environments. The delivery pipeline can also be extended to automate the release of infrastructure by implementing Infrastructure as Code. Using containers for application deployment can help the developers ensure that their applications run in consistent environments without requiring any effort from the operations teams.

Leveraging all the continuous technologies and DevOps practices can help the developers and operations set up fast, reproducible, and reliable pipelines to deliver applications to production. Furthermore, effective implementation of the DevOps practices can enable an organization to focus on designing, implementing, and delivering quality software efficiently without worrying about the infrastructure.

{{< subscribe >}}
