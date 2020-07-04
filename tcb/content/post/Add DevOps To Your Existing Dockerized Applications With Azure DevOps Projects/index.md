---
title: "Add DevOps To Your Existing Dockerized Applications With Azure DevOps Projects"
date: 2018-07-26
tags:
  - azure
  - devops
  - compute
---

As a cloud developer, the current offering to add support for DevOps (CI\CD) to an a. In VSTS, tasks such as creating CI and CD workflows, linking the pipelines with code repository, and adding monitoring take a little time even though the quick start templates have considerably optimized the process. A new offering from Azure named [Microsoft Azure DevOps Projects](https://docs.microsoft.com/en-us/azure/devops-project/) fills this gap in the DevOps offering.

Using Azure DevOps Projects, you can:

1. Setup a new application and DevOps pipeline in a couple of clicks with the whole process taking less than 10 minutes.
2. Build your application on any popular framework such as .Net, and Java and create a DevOps workflow using an inbuilt template.
3. Get analytics automatically provisioned for you using Application Insights.
4. Bring the goodness of DevOps to existing projects.

The Azure DevOps Projects make it simple for you to choose appropriate Azure services to host your application and allows you to focus on building applications rather than build and release pipelines. You can read more about Azure DevOps projects [here](https://docs.microsoft.com/en-us/azure/devops-project/).

Remember, although you will be interacting with wizards in Azure Management Portal to configure a DevOps project, you can still tweak the build and release workflows that are automatically generated to suit your needs. In fact, we will do just that in our example that we will discuss in this article.

## The Application

The [DevOps Projects documentation](https://docs.microsoft.com/en-us/azure/devops-project/) is excellent at explaining how you can onboard new applications to Azure DevOps. However, it is equally easy to onboard an existing application to Azure DevOps Projects as long as you can build your application using a single Dockerfile (Compose capabilities are not available yet). For our example, we will use the ASP.net core application generated from the default application template from Visual Studio. The following image shows the Visual Studio template selection wizard.

{{< img src="1.png" alt="Default ASP.net Core Application" >}}

Notice that I have enabled Docker support in the dialog. However, you can easily [add docker support to your existing application](https://docs.microsoft.com/en-us/aspnet/core/host-and-deploy/docker/visual-studio-tools-for-docker?view=aspnetcore-2.1) by right clicking your project in Solution Explorer and selecting **Add &rarr; Docker Support**.

You will notice that the solution that unfolds after completing the wizard contains a Dockerfile with instructions for building an image, and a Docker Compose project which contains definitions for multi-container Docker applications. Remove the Docker Compose project and replace the code in the Docker file to the following code listing. If you are starting with an existing .Net core project, then add a Dockerfile with the following code at the root of the project.

```Dockerfile
FROM microsoft/dotnet:2.1-aspnetcore-runtime AS base
WORKDIR /app

FROM microsoft/dotnet:2.1-sdk AS build
WORKDIR /src
COPY DevOpsTest/DevOpsTest.csproj DevOpsTest/
RUN dotnet restore DevOpsTest/DevOpsTest.csproj
COPY . .
WORKDIR /src/DevOpsTest
RUN dotnet build DevOpsTest.csproj -c Release -o /app

FROM build AS publish
RUN dotnet publish DevOpsTest.csproj -c Release -o /app

FROM base AS final
WORKDIR /app
COPY --from=publish /app .
ENTRYPOINT ["dotnet", "DevOpsTest.dll"]
```

Following is how my solution structure looks like.

{{< img src="2.png" alt="DevOpsTest solution structure" >}}

Your code should be present in a git repository for the integration to work. My repository is present in GitHub. However, you can choose any source control that you like such as BitBucket, GitLab, and Visual Studio.

## DevOps Project

Head over to the Azure management portal and search for **DevOps Project** in the search bar and click on the **Add** button. Next, in the wizard, select the **Bring Your Own Code** option.

{{< img src="3.png" alt="Select Bring Your Own Code Option" >}}

In the next step, you will be asked to connect your repository to the DevOps Project. I am going to select **GitHub** and follow the steps to connect the repository to the project. If your project is hosted elsewhere, you can choose the **External Git** option and supply the repository details including the branch which triggers the builds.

{{< img src="4.png" alt="Select Your Code Repository" >}}

In the next step, you need to tell the DevOps Project whether your application supports execution in a container. If your application is not Dockerized, you can toggle this option to **No**. However, since our application is containerized, we will set this option to **Yes**. Next, we need to choose the framework that we have used for building this application. We will set this option to **ASP.Net Core**.

{{< img src="5.png" alt="Select Docker Option For Your App" >}}

In the next step, we are given the infrastructure options for hosting our application. We can host a containerized application in AKS (Azure Kubernetes Service) and Web App for Containers. I have chosen the **Web App for Containers** option. You will be asked to supply the path to the Dockerfile in this step. The path can be relative or absolute. I have set it to \*\* **/DevOpsTest/DockerFile** since my file is present inside the DevOpsTest project folder.

{{< img src="6.png" alt="Enter Your DockerFile Path" >}}

In the final step, you will need to create or use an existing VSTS account for building and deploying your application. The VSTS account that you select will host the build and release workflows for your project. You will also need to specify the name and location of the WebApp which will host your application.

{{< img src="7.png" alt="Set VSTS Account and Azure Resources" >}}

You can customize the Azure Resources that you have specified by clicking on the **Change** button. I have used this option to specify the resource group and the name of Azure Container Registry that I want to use.

{{< img src="8.png" alt="Customize Azure Resources" >}}

After you click the **Complete** button, a four-stage operation starts in the background.

1. **Azure Resources**: All Azure resources such as App Service, App Service Plan, and Web App are provisioned.
2. **Repository**: A Git repository is created in VSTS, and the code is checked in.
3. **CI/CD Pipeline**: A CI and CD pipeline is created and connected to your repository.
4. **Application Insights**: An AppInsight resource is created and connected to your WebApp to monitor the application in real-time.

You can see the outcomes of all the stages by navigating to the dashboard of the DevOps Project that you just created.

{{< img src="9.png" alt="DevOps Project Dashboard.png" >}}

In the dashboard, you can navigate to the CI and CD pipelines that the DevOps Project created for you. Note that the DevOps Project deploys your code only to the Dev environment which does not require manual approval, has no Gates, and has only one task that deploys the code to the Azure AppService. At this moment, our builds must be failing because we have some more work left to do.

Navigate to the build definition that the DevOps Project generated for us. There are two steps in the definition, one to build the image and another to publish the image to the container registry. Note that our Dockerfile is located inside the project folder. However, the various paths that we have used in the Dockerfile would only work from the root of the repository. By default, the build context is set to the location of the Dockerfile which we will now change to the root of the directory.

{{< img src="10.png" alt="Setting The Build Context" >}}

We are done making changes now. Now, queue a new build and navigate to the website which should now be available at the application endpoint. Following is a screenshot of my application in action.

{{< img src="11.png" alt="DevOpsTest Application" >}}

A key thing to remember is that WebApps supports communication only through the HTTP (port 80) and HTTPS (port 443). This fact is conveniently documented [here](https://github.com/projectkudu/kudu/wiki/Azure-Web-App-sandbox) :smile:. I spent quite some time figuring this out on my own, therefore, don't make the same mistake that I did.

{{< subscribe >}}
