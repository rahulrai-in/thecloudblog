---
title: Scheduling Jobs on Heroku with Azure Logic Apps
date: 2020-12-16
tags:
  - azure
draft: true
comment_id: https://www.uuidgenerator.net/version4
---

Many times your application needs to run tasks/jobs on regular intervals. Some scenarios where scheduling might be necessary are polling an API every night or dispatching emails with reports every week. There are several approaches to scheduling jobs on Heroku. Heroku documentation details [one of the strategies](https://devcenter.heroku.com/articles/scheduled-jobs-custom-clock-processes) using a custom scheduling process that you can adopt for the purpose. Another strategy to run scheduled jobs on Heroku is to use the [Heroku scheduler add-on](https://devcenter.heroku.com/articles/scheduler), which is cost-effective but unreliable.

A job scheduler is responsible for triggering background jobs. The scheduler process is often run on a single host instance to avoid triggering multiple instances of the background jobs simultaneously. The approach to use a single host instance for the job scheduler is not ideal for two reasons.

1. [Heroku recommends](https://devcenter.heroku.com/articles/dynos) running multiple dynos for redundancy.
2. You are paying to keep the scheduler running that might be idle most of the time.

[Heroku documentation](https://devcenter.heroku.com/articles/dynos) outlines several types of dynos that you can use to host relevant workloads. Heroku recommends using [one-off dynos](https://devcenter.heroku.com/articles/one-off-dynos) for executing scheduled jobs in a disconnected manner because, with one-off dynos, you only pay for the time that your dyno spends processing data rather than sitting idle.

Now that we understand the type of dyno that we can use to run scheduled jobs let's discuss the managed scheduler service from Azure that we can use to kick off the one-off job dynos.

## Job Scheduling with Azure Logic Apps

The [Azure Logic Apps](https://docs.microsoft.com/en-us/azure/logic-apps/logic-apps-overview) cloud service helps you automate and orchestrate workflows on the cloud. With Azure Logic Apps, you can build enterprise integration solutions using the many connectors available for popular cloud services such as SAP, Oracle DB, and Salesforce.

Azure Logic Apps support running recurring tasks and processes on a schedule using the schedule trigger. You can read the [Microsoft guide](https://docs.microsoft.com/en-us/azure/logic-apps/concepts-schedule-automated-recurring-tasks-workflows) to understand the Logic Apps support for executing recurring tasks. Following are some scheduling patterns that can be implemented using Azure Logic Apps ([source: Microsoft](https://docs.microsoft.com/en-us/azure/connectors/connectors-native-recurrence)).

1. Run immediately and repeat every n number of seconds, minutes, hours, days, weeks, or months.
2. Start at a specific date and time, then run and repeat every n number of seconds, minutes, hours, days, weeks, or months.
3. Run and repeat at one or more times each day, for example, at 8:00 AM and 5:00 PM.
4. Run and repeat each week, but only for specific days, such as Saturday and Sunday.
5. Run and repeat each week, but only for specific days and times, such as Monday through Friday at 8:00 AM and 5:00 PM.

One great thing about using the Azure Logic Apps is that you [only pay for the execution of actions](https://docs.microsoft.com/en-us/azure/logic-apps/logic-apps-pricing), and hence money is not wasted on services sitting idle.

## Scenario

[Unsplash](https://unsplash.com/) has a rich library of images and [REST APIs](https://source.unsplash.com/) to fetch them on-demand. It would be great to have them mailed to me every day. I am going to create an application named **Picletter**, which I will be host as a one-off dyno. When executed, this application will fetch the [day's image](https://source.unsplash.com/daily) from Unsplash and use the [SendGrid email service](https://sendgrid.com/) to send me the picture in an email. To schedule the Picletter application's execution, I will create an Azure Logic App with a schedule trigger configured to execute every day. Upon execution, the Logic App will use the [Heroku Platform API](https://devcenter.heroku.com/articles/platform-api-reference) to run the Picletter application.

Following is the sequence diagram that illustrates the workflow.

{{< img src="1.png" alt="Picletter sequence diagram" >}}

For reference, the source code of the application and the Azure Logic App deployment template is available in my GitHub Repository.

{{< sourceCode src="https://github.com/rahulrai-in/az-heroku-scheduled-tasks" >}}

Let's now build and deploy the Picletter app to Heroku.

## Picletter App

There are three ways to interact with Heroku: the User Interface, Platform API, and the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli). Due to its simplicity, the CLI is my preferred tool to create and manage Heroku apps. Let's begin the process of creating the Picletter Heroku application by executing the following command. Remember to choose another name of the application if the one below is not available.

```sh
$ heroku create scheduled-task-demo

--> POST /apps
--> {"name":"scheduled-task-demo"}
Creating ⬢ scheduled-task-demo... /
<-- 201 Created
<-- {"acm":false,"archived_at":null,"buildpack_provided_description":null,"build_stack":{"id":"69bee368-352b-4bd0-9b7c-819d860a2588","name":"heroku-18"},"created_at":"2020-12-23T10:49:12Z","id":"e2b72517-ae53-4193-a716-ac442f423ca4","git_url":"https://git.heroku.com/scheduled-task-demo.git","maintenance":false,"name":"scheduled-task-demo","owner":{"email":"","id":"970f7a39-0f0a-421b-b7c1-218caca864c5"},"region":{"id":"59accabd-516d-4f0e-83e6-6e3757701145","name":"us"},"organization":null,"team":null,"space":null,"internal_routing":null,"released_at":"2020-12-23T10:49:12Z","repo_size":null,"slug_size":null,"stack":{"id":"69bee368-352b-4bd0-9b7c-819d860a2588","name":"heroku-18"},"updated_at":"2Creating ⬢ scheduled-task-demo... done
https://scheduled-task-demo.herokuapp.com/ | https://git.heroku.com/scheduled-task-demo.git
```

For [inner loop development](https://mitchdenny.com/the-inner-loop/), I configure my CLI tools to produce verbose output to quickly identify and fix any issues. To enable verbose output from the Heroku CLI, set an environment variable `HEROKU_DEBUG` with value 1.

Note that on the execution of the previous command, Heroku generated a remote Git repository for us. On every push of your application code to this repository, Heroku will attempt to build and deploy your application. Create a folder on your system to store the application code, launch the terminal, and change directory (`cd`) to the folder. Next, execute the following commands to set up a local Git repository, and set the Heroku hosted Git repository as the upstream remote repository.

```sh
$ git init
$ heroku git:remote -a scheduled-task-demo
```

After the integration is set up, we will be able to commit and push code to the remote repository, and Heroku will attempt to deploy the application on every push. Let's build the Picletter application now. I am going to use Go, which is one of the programming languages [supported by Heroku](https://www.heroku.com/languages). I will not discuss the basics of building and deploying Golang apps to Heroku because Heroku has an [excellent getting started guide](https://devcenter.heroku.com/articles/getting-started-with-go) on writing applications with Go and deploying them to Heroku that you can follow.

Let's begin with creating a Go module. Execute the following command to create a new module named **picletter**.

```sh
$ go mod init tcblabs.net/picletter
```

After execution, the command will generate a module file named **go.mod** that contains the module's name, the Go version, and the dependencies used by the module. To fix the version of Go used by Heroku for building the module, add the following comment to the **go.mod** file, after which the module file should look like the following.

```go
module tcblabs.net/picletter

// +heroku goVersion go1.15
go 1.15
```

Execute the following command to install the necessary packages for our application. We will install the SendGrid Go packages to prepare and send emails and a library named **imgbase64** to download an image from Unsplash and convert it to Base64 format.

```sh
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

You must have noticed that we used a couple of environment variables to configure the application. Heroku supports [storing the configuration values (called config vars)](https://devcenter.heroku.com/articles/config-vars) specific to your app’s deployment in a separate configuration registry. With individual configuration registries, you can set different values of the same variable for different environments. For example, the connection string for the dev deployment can point to the dev database, and that for the prod deployment can point to the prod database. Heroku makes the config vars available as environment variables to your application.

Let's execute the following command to set the values of the config vars/environment variables for our application.

```sh
$ heroku config:set BOT_EMAIL=rahulrai@live.com RECEIVER_EMAIL=rahulrai@ymail.com SG_KEY=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 -a scheduled-task-demo
```

Heroku doesn't yet know how it can start our application. We'll add a [Procfile](https://devcenter.heroku.com/articles/procfile) that specifies the command that Heroku will use to launch our application.

```sh
worker: picletter
```

Just like a **gitignore** file is used to specify intentionally untracked files in Git, you can use a **slugignore** file to [omit unnecessary files](https://devcenter.heroku.com/articles/slug-compiler) from getting deployed on the Heroku dyno. I don't want to include the Azure Logic App ARM template and the README file in the application build artifacts, and hence I have added the following specifications to the **.slugignore** file.

```plaintext
/logic-app
README.md
```

We are now ready to deploy the Picletter app to Heroku. Let's now push the code to the Heroku Git repository, which will kick off the application build and deployment on Heroku.

```sh
$ git add .
$ git commit -am "picletter app"
$ git push heroku master
```

Let's navigate to the [Heroku dashboard](https://dashboard.heroku.com/) to visually inspect the deployment and the config vars we set earlier.

{{< img src="2.png" alt="Picletter resources view" >}}

You can see that no dynos are running the Picletter application currently. The Picletter app is hosted on a [one-off dyno](https://devcenter.heroku.com/articles/one-off-dynos) that we can trigger on-demand and pay only for the duration for which the application stays active. Before we execute the application, let’s inspect the config vars for our application as well. Click on the Settings tab and validate the config vars values.

{{< img src="3.png" alt="Picletter settings view" >}}

Let's now use the Heroku CLI to execute the Picletter application once. Execute the following command after substituting the name of the Heroku application in the command argument with the one you previously created.

```sh
$ heroku run worker -a scheduled-task-demo

Running worker on ⬢ scheduled-task-demo... up, run.6966 (Standard-1X)
202

...
```

After receiving a response indicating success from the command, we can navigate to the mailbox of the email that we specified as the value of the `RECEIVER_EMAIL` config var. The following screenshot shows the email that I received in my mailbox after executing the Picletter application.

{{< img src="4.png" alt="Email received from Picletter application" >}}

If you do not receive an email, check the application logs and SendGrid [email activity](https://app.sendgrid.com/email_activity) report to ensure no application errors or deliverability issues with the email.

We used the Heroku CLI to trigger the previous dyno run. Let's now use Azure Logic Apps and Heroku Platform API to automate the execution of the application on a schedule.

## Scheduling Picletter Application Run with Azure Logic Apps

Let's deploy the Logic App with the [Azure Resource Manager (ARM)](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/overview) template available in the **logic-app** folder in the repository. The ARM template defines a workflow triggered by a recurrence trigger (called schedule trigger) scheduled for execution every day. The schedule trigger executes an HTTP action that sends a POST request to the [Heroku Dyno Platform API](https://devcenter.heroku.com/articles/platform-api-reference#dyno) to run the one-off Picletter dyno. Remember to update the value of the `uri` parameter of the ARM template to mention the name of the Heroku app that you created earlier. Also, note that you can specify the SKU of the dyno that should host the Picletter job in the HTTP request body.

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

All resources in Azure must exist under a [Resource Group](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/overview). So, let's create a resource group named **picletter-rg** and use the ARM template to create a Logic App within the resource group with the following [Azure CLI commands](https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/deploy-cli). Note that we must pass the name of the Logic App and Heroku Platform API authorization token as parameters to the template. To generate a token that you can use to authorize your Platform API calls, refer to the [Authentication section of the Platform API quickstart guide](https://devcenter.heroku.com/articles/platform-api-quickstart#authentication).

```sh
$ az group create -l australiaeast -n picletter-rg
$ az deployment group create --resource-group picletter-rg --template-file picletter-app.definition.json --parameters heroku_token=89126a66-bec0-40e3-a604-6ce16cf0079f workflows_picletter_app_name=picletter-logic-app
```

After executing the commands, let’s visit the [Azure management portal](https://portal.azure.com/) to inspect the Logic App that we just created. Since we did not configure the start time of the recurrence schedule, you will notice that the workflow executes soon after we deploy it and every 24 hours after then. Click on the latest workflow run in the **Runs History** section to view the details of the run.

{{< img src="5.png" alt="Azure Logic App runs" >}}

You can expand the workflow actions of the run to view the input and output of each action. The following screenshot shows the expanded view of one of the runs of the Logic App. You can see that we supplied the schedule details as arguments to the Recurrence trigger. You can also see the Heroku Platform API HTTP request details that we configured as input for the HTTP action. We can also see that the HTTP action received success response for the request that it made for this run.

{{< img src="6.png" alt="Expanded Logic App run" >}}

Since the workflow run succeeded, we likely received the email as well. Let’s go back to our mailbox to view the email we received from the Picletter app triggered by the Logic App.

{{< img src="7.png" alt="Email from the Picletter app" >}}

Do not forget to clear the resources that you created in Heroku and Azure for this demo to avoid any surprises in the bills.

## Conclusion

We discussed the pros and cons of a few strategies that you can use to execute scheduled jobs on Heroku. By combining the services of Azure and Heroku, we built an easy to maintain and simple solution that is cost-effective and reliable. As a further improvement to the sample, you can add support for [sliding window triggers](https://docs.microsoft.com/en-us/azure/connectors/connectors-native-sliding-window) to retry operations for any missed execution windows.

If you are requesting Heroku to run the one-off dyno in detached mode from the Logic App, you can also try recording the progress or status of a one-off dyno run using the [dyno info API](https://devcenter.heroku.com/articles/platform-api-reference#dyno-info). Using the details that you receive, you can raise alerts or update the Logic App to cancel a run if a dyno is already in an active state from the previous run.

I hope you enjoyed building this sample and learned about simplifying an integration scenario using the services of different clouds.

{{< subscribe >}}
