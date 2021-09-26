---
title: "Draft 10 Sep 21"
date: 2021-09-10
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Continuous Delivery

## Introduction

- "CI/CD" and "DevOps" are terms in the industry that are thrown around, without necessarily much thought about what we mean when we use them.

- In this article, we're going to discuss "Continuous Delivery" and its relationship to DevOps and CI/CD.

- We'll start with a basic description of "Continuous Delivery", from [Martin Fowler](https://martinfowler.com/bliki/ContinuousDelivery.html): "Continuous Delivery is a software development discipline where you build software in such a way that the software can be released to production at any time."

- This means that, at any given time, you have code that has been tested, verified, built, packaged, and ready for deployment to production at the push of a button.

## DevOps: A Culture with Best Practices

- Culture: Collaboration and shared responsibility between the development team and the operations team for a software product.

- Best Practices

- Agile project management

- Testing is performed early in the development process, to improve code quality and move a project more quickly toward being release-able.

- Testing and release use automated tools and processes.

- Release process and released software are monitored and observed

- How does this inform our understanding of Continuous Delivery?

- The pipeline for performing all of the steps from testing/validation up through deployment is also known as the Continuous Delivery pipeline.

- Ideally, all of the steps in the Continuous Delivery pipeline (except for one) are automated.

## The Steps in Continuous Delivery

- Gather changes in the code

- Integration testing (The CI part of CI/CD)

- Build application

- Package application

- Produce a deployable release

- At the end of these automated steps, the application is "ready to deploy at the push of a button." The pushing of that button is the only non-automated part of Continuous Delivery.

- When the button has been pushed, this kicks off all of the automated steps in Continuous Deployment (The CD part of CI/CD), which deploys the release to make it available to end-users.

## Continuous Integration as a part of Continuous Delivery

- As noted, the entire CI/CD pipeline is the Continuous Delivery pipeline.

- Continuous Integration is the CI part of CI/CD.

- CI merges and validates code changes from the developer.

- Prevents broken code from proceeding any further in the pipeline.

- CI is automated through integrations with Git repositories. Upon detection of a push of new code, CI processes can automatically trigger, testing and validating new code changes immediately.

## The Difference between Continuous Delivery and Continuous Deployment

- Continuous Deployment is the CD part of CI/CD.

- CD takes an already-packaged, deployable release and makes it available to end-users.

- This may involve infrastructure provisioning (or de-provisioning), or network configurations.

- Automated through infrastructure-as-code.

- In a pure Continuous Deployment model, a developer's push of new code goes through integration testing and then---if tests pass---is packaged and deployed for immediate availability to end-users.

- Continuous Delivery, however, ensures that an application is always ready to be deployed at the push of a button. But that code is not deployed without some manual action being taken.

- This is why the CD in CI/CD sometimes refers to Continuous Delivery. It depends on the deployment strategy. If deployment is automated (continuous, without need for manual action), then CD is "Continuous Deployment." If deployment requires manual action (scheduled release, push of a button), then CD is "Continuous Delivery."

## Conclusion

- Review major points

- FAQ

{{< img src="" alt="" >}}

{{< sourceCode src="https://github.com/rahulrai-in/" >}}

{{< subscribe >}}
