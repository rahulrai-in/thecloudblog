---
title: "Building Data Pipelines with Microsoft Azure Data Factory"
date: 2015-10-25
tags:
  - azure
  - analytics
comment_id: 7c7de466-43d2-4fb4-9f35-c2928c3bfee1
---

My [Google Analytics](https://www.google.com/analytics/) and [Application Insights](https://azure.microsoft.com/en-in/services/application-insights/) Telemetry data indicates that it is time for me to thank you for appreciating my articles. If you are reading this, I would like to thank you for your support. I have met many people to whom cloud and its service offerings make little sense. I want to demonstrate how easy it is to get up to speed with using cloud offerings because I find most of the samples available online are a little tough to comprehend. I try keeping my samples short and fun, and always free for you to use. If you haven't already, please take a minute to [subscribe](https://landing.mailerlite.com/webforms/landing/o2t0g4) and provide your feedback through comments on posts or through email at [rahul@rahul-rai.com](mailto:rahul@rahul-rai.com). I love reading your mails and comments, so keep them coming. Thanks a lot again!

Let's discuss [Azure Data Factory](https://azure.microsoft.com/en-in/documentation/articles/data-factory-introduction/) today. Many of the customers that I work with have a common business problem. They have varying amounts of disparate data that is spread over various systems or data storages. They want to combine the data from multiple sources and convert it into meaningful business information. Tools such as [SSIS](https://msdn.microsoft.com/en-us/library/ms141026.aspx) perform the task of ETL quite well, but SSIS is not meant for working with Big Data and also not meant for extracting data from varied sources, which may be structured or unstructured. Often, such demands lead us to design custom logic which ultimately becomes difficult to manage and update.

[Azure Data Factory](https://azure.microsoft.com/en-in/documentation/articles/data-factory-introduction/) is a solution to these problems. The four major areas that Data Factory addresses today are:

1.  Ingest and publish data from/to on premises, cloud and SaaS.

2.  Transform the ingested data using [Azure HDInsight](http://azure.microsoft.com/documentation/services/hdinsight/), [Azure Batch](http://azure.microsoft.com/documentation/services/batch/), custom C# activity etc..

3.  Integrate data from multiple sources irrespective of the format of data such as data from social feeds and an RDBMS on any cloud.

4.  Orchestrate & monitor your data flow pipelines from a single unified view to pinpoint issues and setup monitoring alerts.

## Azure Data Factory Components

If you have about three minutes to spare, I encourage you to watch an introductory video of Azure Data Factory posted [here](http://channel9.msdn.com/Blogs/Windows-Azure/Azure-Data-Factory-Overview/player/). The Azure blog contains a brief overview of Data Factory components which you should read [here](https://azure.microsoft.com/en-in/documentation/articles/data-factory-introduction/#key-concepts). Once you are through with these two artifacts, you should be ready to start writing some code to work with Azure Data Factory.

## Let's Code

Now that we have an understanding of what Data Factory is, it is a good time to build a sample application for a scenario that most of us encounter on a regular basis. Many applications get a nightly data feed in CSV format that needs to be imported to the application database. If you have ever written code for such systems, you know that you need to take care of multiple aspects such as scheduling, data volume, monitoring and logging. Let us build a Data Factory pipeline which will take care of all these aspects and much more.

## Download The Code Sample

The complete code for the sample we are going to build is available for download here.

{{< sourceCode src="https://github.com/rahulrai-in/integrationfactory">}}

At this point you should download a copy of it. Although, I wrote the code using Data Factory SDK for Visual Studio (available by searching for **Microsoft Azure DataFactory Tools for Visual Studio** in extensions gallery), the Data Factory IDE is already embedded in the Azure management portal, therefore using Visual Studio is not a necessity. The IDE provides support for validating the JSON files on build and uploading them to your Data Factory on publish and is good for keeping artifacts in source control, sharing code etc. and therefore should be used for any code that you expect to move to production.

## Preparing The Database and The Test File

The sample file **SampleData-yyyy-mm-dd.csv** in the source code of the sample contains sales data which would arrive as a nightly feed for us to consume. Place this file in a folder on your system and populate the placeholder fields in the file name. Now, create an Azure SQL Database and use the SQL script in sample **CreateSalesDataTable.sql** to create **SalesData** table that would get populated by the Data Factory pipeline that we would soon build.

## Create Data Factory Pipeline

In [Azure Management Portal](https://portal.azure.com/), create a new Data Factory instance and supply the necessary values such as a unique name and resource group to provision it.

{{< img src="1.png" alt="Create Data Factory In Portal" >}}

Now, we need to create a gateway in our Data Factory instance. A gateway is a service that is setup on your local system so that Data Factory can access data stored on it. To create a gateway, click on the Data Factory instance that you just created and click on **Author and Deploy**. This will launch Data Factory authoring blade which you can use instead of Visual Studio to create your Data Factory pipeline. Click on **More Commands** and click on **New Data Gateway**. Now give a name to your gateway and click **OK**. Next, you would be prompted to download the gateway setup. You can either download the setup with your gateway key already configured or download the setup and apply the key mentioned in the **Key** field.

{{< img src="2.png" alt="Create Data Factory Gateway" >}}

You need to run the setup and make sure that it is able to connect to Data Management Cloud Service.

{{< img src="3.png" alt="Data Management Gateway" >}}

Now, in your Visual Studio create a new solution and add add an empty data factory project to it.

{{< img src="4.png" alt="Create Data Factory Project" >}}

Right click on **LinkedService** folder and add **Azure SQL Linked Service** and **On Premises FileSystem Linked Service**. A linked service contains information necessary for your Data Factory to connect to an external service. As the name suggests, **Azure SQL Linked Service** contains connection data for Azure SQL Database. Put the following code in the **Azure SQL Linked Service** JSON file:

```json
{
  "$schema": "http://datafactories.schema.management.azure.com/schemas/2015-08-01/Microsoft.DataFactory.LinkedService.json",
  "name": "AzureSqlLinkedService",
  "properties": {
    "type": "AzureSqlDatabase",
    "typeProperties": {
      "connectionString": "<<Azure SQL Database Connection string>>"
    }
  }
}
```

Similarly, the **On Premises FileSystem Linked Service** contains information for connecting to your system through the gateway that you just installed. Replace the template code inside **On Premises FileSystem Linked Service** with the following code.

```json
{
  "$schema": "http://datafactories.schema.management.azure.com/schemas/2015-08-01/Microsoft.DataFactory.LinkedService.json",
  "name": "OnPremisesFileSystemLinkedService",
  "properties": {
    "type": "OnPremisesFileServer",
    "typeProperties": {
      "host": "localhost",
      "userId": "DOMAINUSERNAME OR USERNAME",
      "password": "YOUR SYSTEM PASSWORD",
      "gatewayName": "YOUR GATEWAY NAME"
    }
  }
}
```

This code contains information about the system that Data Factory pipeline needs to connect to and credentials that it can use to get the resource that it uses. Now, we need to create tables corresponding to the on premises file and Azure SQL Database so that data can be copied between the two tables through a copy activity, which we will configure soon. Right click on the **Tables** folder and select **Add** new **OnPremises FileShare Location**. Replace the code within the template with the following code.

```json
{
  "$schema": "http://datafactories.schema.management.azure.com/schemas/2015-08-01/Microsoft.DataFactory.Table.json",
  "name": "PremiseSystemDataTable",
  "properties": {
    "type": "FileShare",
    "linkedServiceName": "OnPremisesFileSystemLinkedService",
    "typeProperties": {
      "folderPath": "DRIVE LETTER:\\FOLDER PATH TO YOUR BATCH FILE",
      "fileName": "SampleData-{Year}-{Month}-{Day}.csv",
      "partitionedBy": [
        {
          "name": "Year",
          "value": {
            "type": "DateTime",
            "date": "SliceStart",
            "format": "yyyy"
          }
        },
        {
          "name": "Month",
          "value": {
            "type": "DateTime",
            "date": "SliceStart",
            "format": "MM"
          }
        },
        {
          "name": "Day",
          "value": {
            "type": "DateTime",
            "date": "SliceStart",
            "format": "dd"
          }
        }
      ]
    },
    "structure": [
      {
        "name": "OrderDate",
        "type": "Datetime"
      },
      {
        "name": "Region",
        "type": "String"
      },
      {
        "name": "Rep",
        "type": "String"
      },
      {
        "name": "Item",
        "type": "String"
      },
      {
        "name": "Units",
        "type": "Int32"
      },
      {
        "name": "Unit Cost",
        "type": "Decimal"
      },
      {
        "name": "Total",
        "type": "Decimal"
      }
    ],
    "external": true,
    "availability": {
      "frequency": "Day",
      "interval": 1
    }
  }
}
```

This code specifies path to the folder which contains the file which we want to upload and the associated linked service. Notice that we have specified replacement text for year, month and day so that a different file is picked every time the pipeline is executed. We have also specified the structure of the file and availability of the table. The availability element tells the ADF runtime how often to expect new slice data to be available: in this case, once per day. It makes sense to set availability to correspond to the expected timing when the external process will actually drop data into the blob store: otherwise the copy activity may execute unnecessarily looking for data that is not, in fact, available.

Next, add new **Azure SQL** table in the tables folder and replace the code with the following code.

```json
{
  "$schema": "http://datafactories.schema.management.azure.com/schemas/2015-08-01/Microsoft.DataFactory.Table.json",
  "name": "AzureSQLDataTable",
  "properties": {
    "type": "AzureSqlTable",
    "linkedServiceName": "AzureSqlLinkedService",
    "structure": [
      {
        "name": "OrderDate",
        "type": "Datetime"
      },
      {
        "name": "Region",
        "type": "String"
      },
      {
        "name": "Rep",
        "type": "String"
      },
      {
        "name": "Item",
        "type": "String"
      },
      {
        "name": "Units",
        "type": "Int32"
      },
      {
        "name": "Unit Cost",
        "type": "Decimal"
      },
      {
        "name": "Total",
        "type": "Decimal"
      }
    ],
    "typeProperties": {
      "tableName": "SalesData"
    },
    "availability": {
      "frequency": "Day",
      "interval": 1
    }
  }
}
```

This code specifies the table structure with the same name of columns as specified previously. This ensures that we don't have to apply any transformation to map the two tables (although you can). It also specifies the name of table to which we need to store data.

The last thing we need to do is to copy data between these two data stores. Data Factory provides an activity to copy data between two data stores. The store can be either a cloud or on-premises store. It consumes one input and produces one output. The **type** of the activity should set to **CopyActivity** in the pipeline JSON definition. Right click on the pipeline folder and Add new **Copy Data Pipeline** to the project. Replace the template code with the following code.

```json
{
  "name": "CopyActivityFileToDatabase",
  "properties": {
    "description": "Copy sales data batch file to sales database",
    "activities": [
      {
        "type": "Copy",
        "typeProperties": {
          "source": {
            "type": "FileSystemSource"
          },
          "sink": {
            "type": "SqlSink",
            "writeBatchSize": 1,
            "writeBatchTimeout": "00:30:00"
          }
        },
        "inputs": [
          {
            "name": "PremiseSystemDataTable"
          }
        ],
        "outputs": [
          {
            "name": "AzureSQLDataTable"
          }
        ],
        "policy": {
          "timeout": "00:10:00",
          "concurrency": 1,
          "retry": 1
        },
        "scheduler": {
          "frequency": "Day",
          "interval": 1
        },
        "name": "CopyPremiseBatchFileToDatabase"
      }
    ],
    "start": "2015-07-12T00:00:00Z",
    "end": "2016-07-13T00:00:00Z",
    "isPaused": false,
    "hubName": "integrationfactory_hub"
  }
}
```

This code links the two tables and specifies the type of the two data stores. Finally, this activity specifies the scheduler interval and start and end date of the activity. Note that we haven't specified any SQL statement to push data into the database or any file operations to pull data from the on premises directory. All such operations have been taken care of by the activity. Your solution should resemble the following once you are done.

{{< img src="5.png" alt="Data Factory Solution" >}}

Now, let's deploy the solution. Simply right click the project and select publish. Specify the required details and you are all set.

{{< img src="6.png" alt="Publish Data Factory" >}}

Once published if everything works fine, you should be able to see data in your database. You can check the status of each run of the pipeline by clicking on **Datasets** and selecting the desired dataset. You can view logs of each run as well.

{{< img src="7.png" alt="Track Runs of Data Factory" >}}

## Output

Following is a screenshot of data that got copied from the file to the database from my deployment.

{{< img src="8.png" alt="Data Factory Copied Records" >}}

As you can imagine, there are many more complex scenarios that you can realize by using Data Factory. I am planning to build an open source Big Data solution using Data Factory in my spare time. Let me know your feedback! Parting to meet again!

{{< subscribe >}}
