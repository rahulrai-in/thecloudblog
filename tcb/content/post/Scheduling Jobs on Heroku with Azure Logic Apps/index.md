---
title: Scheduling Jobs on Heroku with Azure Logic Apps
date: 2021-02-05
tags:
  - azure
  - heroku
  - integration
comment_id: f07ee37d-6f2e-4d0c-896a-907139b14f5f
---

Many times, your application needs to run tasks or jobs on regular intervals. Scheduling might be necessary when polling an API every night, or dispatching emails with reports each week. And sometimes you may find that you need to trigger a _host_ of tasks _across multi- or hybrid-cloud_ and need a way to run these tasks in a reliable, cross-cloud manner.

In this article, let's look at one way to do that using a Heroku dyno for our task, and Microsoft Azure Logic Apps as our scheduler service. The scheduler in Logic Apps allows for triggering workflows that include services across clouds and on-premises, paving the way for easy administration and observability of many disparate tasks. Functionally, the scheduler not only lets you specify simple recurrence rules (such as every minute), but also complex ones (such as every 15 minutes during work hours).

Let's discuss the Azure Logic Apps service in detail next.

## Job Scheduling with Azure Logic Apps

The [Azure Logic Apps](https://docs.microsoft.com/en-us/azure/logic-apps/logic-apps-overview) cloud service helps you automate and orchestrate workflows on the cloud. With Azure Logic Apps, you can build enterprise integration solutions using the many connectors available for popular cloud services such as SAP, Oracle DB, and Salesforce.

Azure Logic Apps support running recurring tasks and processes on a schedule, using the schedule trigger. You can read the [Microsoft guide](https://docs.microsoft.com/en-us/azure/logic-apps/concepts-schedule-automated-recurring-tasks-workflows) to understand the Logic Apps support for executing recurring tasks. The following list offers some scheduling patterns that can be implemented using Azure Logic Apps ([source: Microsoft](https://docs.microsoft.com/en-us/azure/connectors/connectors-native-recurrence)).

1. Run immediately and repeat every n number of seconds, minutes, hours, days, weeks, or months.
2. Start at a specific date and time, then run and repeat every n number of seconds, minutes, hours, days, weeks, or months.
3. Run and repeat at one or more times each day, for example, at 8:00 AM and 5:00 PM.
4. Run and repeat each week, but only for specific days, such as Saturday and Sunday.
5. Run and repeat each week, but only for specific days and times, such as Monday through Friday at 8:00 AM and 5:00 PM.

One great thing about using the Azure Logic Apps is that you [only pay for the execution of actions](https://docs.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing), ensuring money is not wasted on services sitting idle.

## Scenario: One-off Dyno Image Deliveries

[Unsplash](https://unsplash.com/) has a rich library of images and [REST APIs](https://source.unsplash.com/) to fetch them on demand. It would be great to have them mailed to me every day. I am going to create an application named **Picletter**, which I will host as a one-off dyno. When executed, this application will fetch the [day's image](https://source.unsplash.com/daily) from Unsplash and use the [SendGrid email service](https://sendgrid.com/) to send me the picture in an email. To schedule the Picletter application's execution, I will create an Azure Logic App with a schedule trigger configured to execute every day. Upon execution, the Logic App will use the [Heroku Platform API](https://devcenter.heroku.com/articles/platform-api-reference) to run the Picletter application.

The following sequence diagram illustrates the workflow:

{{< img src="1.png" alt="Picletter sequence diagram" >}}

For reference, the source code of the application and the Azure Logic App deployment template is available in my GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/az-heroku-scheduled-tasks" >}}

Let's now build and deploy the Picletter app to Heroku.

## Picletter App

[Heroku documentation](https://devcenter.heroku.com/articles/dynos) outlines several types of dynos that you can use to host relevant workloads. Heroku recommends using [one-off dynos](https://devcenter.heroku.com/articles/one-off-dynos) for executing scheduled jobs in a disconnected manner. That's because with one-off dynos, you only pay for the time your dyno spends processing data, instead of both active and idle time.

There are three ways to interact with Heroku: the User Interface, Platform API, and the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli). Due to its simplicity, the CLI is my preferred tool to create and manage Heroku apps. Let's begin the process of creating the Picletter Heroku application by executing the following command. Remember to choose another name for your application if the one below is not available.

```shell
$ heroku create scheduled-task-demo

--> POST /apps
--> {"name":"scheduled-task-demo"}
Creating ⬢ scheduled-task-demo... /
<-- 201 Created
<-- {"acm":false,"archived_at":null,"buildpack_provided_description":null,"build_stack":{"id":"69bee368-352b-4bd0-9b7c-819d860a2588","name":"heroku-18"},"created_at":"2020-12-23T10:49:12Z","id":"e2b72517-ae53-4193-a716-ac442f423ca4","git_url":"https://git.heroku.com/scheduled-task-demo.git","maintenance":false,"name":"scheduled-task-demo","owner":{"email":"","id":"970f7a39-0f0a-421b-b7c1-218caca864c5"},"region":{"id":"59accabd-516d-4f0e-83e6-6e3757701145","name":"us"},"organization":null,"team":null,"space":null,"internal_routing":null,"released_at":"2020-12-23T10:49:12Z","repo_size":null,"slug_size":null,"stack":{"id":"69bee368-352b-4bd0-9b7c-819d860a2588","name":"heroku-18"},"updated_at":"2Creating ⬢ scheduled-task-demo... done
https://scheduled-task-demo.herokuapp.com/ | https://git.heroku.com/scheduled-task-demo.git
```

For [inner loop development](https://mitchdenny.com/the-inner-loop/), I configure my CLI tools to produce verbose output to quickly identify and fix any issues. To enable verbose output from the Heroku CLI, set an environment variable `HEROKU_DEBUG` with value 1.

Note that on the execution of the previous command, Heroku generated a remote Git repository for us. On every push of your application code to this repository, Heroku will attempt to build and deploy your application. Create a folder on your system to store the application code, launch the terminal, and change directory (`cd`) to the folder. Next, execute the following commands to set up a local Git repository, and set the Heroku-hosted Git repository as the upstream remote repository.

```shell
$ git init
$ heroku git:remote -a scheduled-task-demo
```

After the integration is set up, we will be able to commit and push code to the remote repository, and Heroku will attempt to deploy the application on every push. Let's build the Picletter application now. I am going to use Go, which is one of the programming languages [supported by Heroku](https://www.heroku.com/languages). I will not discuss the basics of building and deploying Golang apps to Heroku, only because Heroku already has an [excellent "getting started" guide](https://devcenter.heroku.com/articles/getting-started-with-go) on writing applications with Go and deploying them to Heroku.

Let's begin with creating a Go module. Execute the following command to create a new module named **picletter**.

```shell
$ go mod init tcblabs.net/picletter
```

After execution, the command will generate a module file named **go.mod** that contains the module's name, the Go version, and the dependencies used by the module. To fix the version of Go used by Heroku for building the module, add the following comment to the **go.mod** file, after which the module file should look like the following:

```go
module tcblabs.net/picletter

// +heroku goVersion go1.15
go 1.15
```

Execute the following command to install the necessary packages for our application. We will install the SendGrid Go packages to prepare and send emails and a library named **imgbase64** to download an image from Unsplash and convert it to Base64 format.

```shell
$ go get github.com/polds/imgbase64
$ go get github.com/sendgrid/sendgrid-go
$ go get github.com/sendgrid/sendgrid-go/helpers/mail
```

Let's now create a file named **main.go** and populate it with the following code. We will first use the Unsplash API to fetch the daily image and then use the SendGrid library to prepare an email containing the image. Finally, we will use the SendGrid library to send the email to the receiver. I encourage you to read the official [SendGrid Golang SDK documentation](https://github.com/sendgrid/sendgrid-go) to understand the library's usage and instructions on fetching the [SendGrid API Key](https://app.sendgrid.com/settings/api_keys) that you will use to authorize API calls to SendGrid.

```go
package picletter

import (
	"fmt"
	"os"

	"github.com/polds/imgbase64"
	"github.com/sendgrid/sendgrid-go"
	"github.com/sendgrid/sendgrid-go/helpers/mail"
)

func main() {
	from := mail.NewEmail("Picletter Bot", os.Getenv("BOT_EMAIL"))
	subject := "Picletter, Your daily picture newsletter!"
	to := mail.NewEmail("Rahul", os.Getenv("RECEIVER_EMAIL"))
	// download image from the Unsplash API
	img := imgbase64.FromRemote("https://source.unsplash.com/daily/")
	content := mail.NewContent("text/html", fmt.Sprintf("<img src=\"%v\">", img))
	// compose email
	m := mail.NewV3MailInit(from, subject, to, content)
	request := sendgrid.GetRequest(os.Getenv("SG_KEY"), "/v3/mail/send", "https://api.sendgrid.com")
	request.Method = "POST"
	request.Body = mail.GetRequestBody(m)
	// send email
	response, err := sendgrid.API(request)
	if err != nil {
		fmt.Println(err)
	} else {
		fmt.Println(response.StatusCode)
		fmt.Println(response.Body)
		fmt.Println(response.Headers)
	}
}
```

You must have noticed that we used a couple of environment variables to configure the application. Heroku supports [storing the configuration values (called config vars)](https://devcenter.heroku.com/articles/config-vars) specific to your app's deployment in a separate configuration registry. With individual configuration registries, you can set different values of the same variable for different environments. For example, the connection string for the dev deployment can point to the dev database, and that same variable when used in the prod deployment can point to the prod database. Heroku makes the config vars available as environment variables to your application.

Let's execute the following command to set the values of the config vars/environment variables for our application.

```shell
$ heroku config:set BOT_EMAIL=<Bot Email Address> RECEIVER_EMAIL=<Receiver Email Address> SG_KEY=<SendGrid API Key> -a scheduled-task-demo
```

Heroku doesn't yet know how it can start our application. We'll add a [Procfile](https://devcenter.heroku.com/articles/procfile) that specifies the command Heroku will use to launch our application.

```shell
worker: picletter
```

Just like a **gitignore** file is used to specify intentionally untracked files in Git, you can use a **slugignore** file to [k](https://devcenter.heroku.com/articles/slug-compiler)eep [unnecessary files](https://devcenter.heroku.com/articles/slug-compiler) from being deployed on the Heroku dyno. I don't want to include the Azure Logic App ARM template and the README file in the application build artifacts, which is why I have added the following specifications to the **.slugignore** file:

```plaintext
/logic-app
README.md
```

We are now ready to deploy the Picletter app to Heroku. Let's now push the code to the Heroku Git repository, which will kick off the application build and deployment on Heroku.

```shell
$ git add .
$ git commit -am "picletter app"
$ git push heroku master
```

Let's navigate to the [Heroku dashboard](https://dashboard.heroku.com/) to visually inspect the deployment and the config vars we set earlier.

{{< img src="2.png" alt="Picletter resources view" >}}

You can see that no dynos are running the Picletter application currently. The Picletter app is hosted on a [one-off dyno](https://devcenter.heroku.com/articles/one-off-dynos) that we trigger on demand and pay for only when the application is active. Before we execute the application, let's inspect the config vars for our application as well. Click on the Settings tab and validate the config vars values.

{{< img src="3.png" alt="Picletter settings view" >}}

Let's now use the Heroku CLI to execute the Picletter application once. Execute the following command after substituting the name of the Heroku application in the command argument with the one you previously created.

```shell
$ heroku run worker -a scheduled-task-demo

Running worker on ⬢ scheduled-task-demo... up, run.6966 (Standard-1X)
202

...
```

After receiving a response indicating success from the command, we can navigate to the email inbox that we specified as the value of the `RECEIVER_EMAIL` config var. The following screenshot shows the email that I received after executing the Picletter application.

{{< img src="4.png" alt="Email received from Picletter application" >}}

If you do not receive an email, check the application logs and SendGrid [email activity](https://app.sendgrid.com/email_activity) report to ensure there are no application errors or deliverability issues.

We used the Heroku CLI to trigger the previous dyno run. Let's now use Azure Logic Apps and Heroku Platform API to automate the execution of the application on a schedule.

## Scheduling Picletter Application Run with Azure Logic Apps

Let's deploy the Logic App with the [Azure Resource Manager (ARM)](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/overview) template available in the **logic-app** folder in the repository. The ARM template defines a workflow triggered by a recurrence trigger (called schedule trigger) scheduled for execution every day. The schedule trigger executes an HTTP action that sends a POST request to the [Heroku Dyno Platform API](https://devcenter.heroku.com/articles/platform-api-reference#dyno) to run the one-off Picletter dyno. Remember to update the value of the ARM template's `uri` parameter so that it mentions the name of the Heroku app you created earlier. Also, note that you can specify the SKU of the dyno that should host the Picletter job in the HTTP request body.

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "workflows_picletter_app_name": {
      "defaultValue": "picletter-app",
      "type": "string"
    },
    "heroku_token": {
      "type": "securestring"
    }
  },
  "resources": [
    {
      "apiVersion": "2017-07-01",
      "location": "australiasoutheast",
      "name": "[parameters('workflows_picletter_app_name')]",
      "properties": {
        "definition": {
          "$schema": "https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#",
          "contentVersion": "1.0.0.0",
          "triggers": {
            "Recurrence": {
              "recurrence": {
                "frequency": "Day",
                "interval": 1
              },
              "type": "Recurrence"
            }
          },
          "actions": {
            "HTTP": {
              "type": "Http",
              "inputs": {
                "body": {
                  "command": "worker",
                  "size": "standard-1X",
                  "time_to_live": 1800
                },
                "headers": {
                  "Accept": "application/vnd.heroku+json; version=3",
                  "Authorization": "[concat('Bearer ', parameters('heroku_token'))]",
                  "Content-Type": "application/json"
                },
                "method": "POST",
                "uri": "https://api.heroku.com/apps/scheduled-task-demo/dynos"
              }
            }
          }
        },
        "state": "Enabled"
      },
      "scale": null,
      "type": "Microsoft.Logic/workflows"
    }
  ]
}
```

All resources in Azure must exist under a [resource group](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/overview). So, let's create a resource group named **picletter-rg** and use the ARM template to create a Logic App within the resource group with the [Azure CLI commands](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/deploy-cli) below. Note that we must pass the name of the Logic App and Heroku Platform API authorization token as parameters to the template. To generate a token that you can use to authorize your Platform API calls, refer to the [authentication section of the Platform API quickstart guide](https://devcenter.heroku.com/articles/platform-api-quickstart#authentication).

```shell
$ az group create -l australiaeast -n picletter-rg
$ az deployment group create --resource-group picletter-rg --template-file picletter-app.definition.json --parameters heroku_token=<Heroku Auth Token> workflows_picletter_app_name=picletter-logic-app
```

After executing the commands, let's visit the [Azure management portal](https://portal.azure.com/) to inspect the Logic App we just created. Since we did not configure the start time of the recurrence schedule, you will notice that the workflow executes soon after we deploy it and every 24 hours afterward. Click on the latest workflow run in the **Runs History** section to view the details of the run.

{{< img src="5.png" alt="Azure Logic App runs" >}}

You can expand the workflow actions of the run to view the input and output of each action. The following screenshot shows a run's expanded view. You can see that we supplied the schedule details as arguments to the Recurrence trigger. You can also see the Heroku Platform API HTTP request details that we configured as input for the HTTP action. Lastly, notice how the HTTP action received a successful response for the request that it made for this run.

{{< img src="6.png" alt="Expanded Logic App run" >}}

Since the workflow run succeeded, we likely received the email as well. Let's go back to our mailbox to view the email we received from the Picletter app triggered by the Logic App.

{{< img src="7.png" alt="Email from the Picletter app" >}}

Do not forget to clear the resources that you created in Heroku and Azure for this demo. That way, you'll avoid any surprise bills from scheduled demo deliveries!

## Conclusion

We discussed the pros and cons of a few strategies that you can use to execute scheduled jobs on Heroku. By combining the services of Azure and Heroku, we built an easy-to-maintain, simple solution that is cost-effective and reliable. As a further improvement to the sample, you can add support for [sliding window triggers](https://docs.microsoft.com/en-us/azure/connectors/connectors-native-sliding-window) to retry operations for any missed execution windows.

If you are requesting Heroku to run the one-off dyno in detached mode from the Logic App, you can also try recording the progress or status of a one-off dyno run using the [dyno info API](https://devcenter.heroku.com/articles/platform-api-reference#dyno-info). Using the details that you receive, you can raise alerts or update the Logic App to cancel a run if a dyno is already in an active state from the previous run.

I hope you enjoyed building this sample and learned about simplifying an integration scenario using different cloud services.

{{< subscribe >}}
