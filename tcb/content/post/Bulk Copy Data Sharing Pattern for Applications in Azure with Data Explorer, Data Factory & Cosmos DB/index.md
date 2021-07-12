---
title: Bulk Copy Data Sharing Pattern for Applications in Azure with Data Explorer, Data Factory & Cosmos DB
date: 2021-07-08
tags:
  - azure
  - analytics
comment_id: df5c2542-bcde-478e-8730-ddc123ac7f34
---

{{< tweet 1414461321584648192 >}}

In the initial stages of a data platform development, data size is small, and you can easily share it via email or services such as Power BI. However, once the platform grows, and different parts of the business become dependent on it, sharing data between systems becomes a big challenge.

In a majority of the data-driven systems, one of the two patterns is used for consuming data.

1. **Low volume and high frequency**: Consuming small amounts of data (usually one or a few records) at very high frequency. This pattern is typically used for serving data on websites.
2. **High volume and low frequency**: Bulk copy of large datasets (GBs or TBs of data) at a low frequency (daily, weekly, etc.). This is common for data ingestion platforms and batch processing systems.

Additionally, there are two less prominent patterns of data consumption:

1. **Low volume and low frequency**: This generally means refreshing a report which any system can usually absorb at no great cost.
2. **High volume and high frequency**: This pattern is implemented in streaming platforms. In general, streaming is used for processing data streams from IoT sensors. You can use Azure services such as [Azure Stream Analytics](https://azure.microsoft.com/en-au/services/stream-analytics/) and [Azure Event Hubs](https://docs.microsoft.com/en-us/azure/event-hubs/event-hubs-about) to build steaming solutions.

This article will discuss an implementation of the **High volume and low frequency** architecture. You will often encounter scenarios where a downstream team or service wants to consume whole datasets owned by your service. For example, data science teams often aggregate data from database replicas of different services to draw insights from a unified dataset on their platform. Similarly, a team that wants to do some additional processing and reshape the data before using it for their scenario can use a replica of your dataset.

Using APIs to serve data in bulk is not optimal after reaching a certain scale. Generally, scenarios that require a bulk copy of data need not optimize for low latency instead of high throughput. The mechanism you can use to share data in bulk depends on the type of cloud service used. It is easiest to share data from purely storage cloud services such as Data Lake Storage. If we have a big dataset in Azure Data Lake Storage, we can easily grant permissions to the downstream principals to read the data and let the reader replicate the data itself.

Sharing underlying data is complex for services that combines storage with compute such as [Azure Data Explorer](https://azure.microsoft.com/en-au/services/data-explorer/). For example, if you grant a downstream service access to your Azure Data Explorer instance, it might run an expensive query that consumes a large amount of CPU and bandwidth resources of the cluster. Excess resource consumption by downstream systems can make other client's queries slow or timeout, which is why we shouldn't share data directly from such services.

A better solution for copying data from services that combine compute and storage is to serve data from a read-only replica of the leader database. For example, Azure Data Explorer allows a [cluster to follow databases from other clusters](https://docs.microsoft.com/en-us/azure/data-explorer/follower). A follower database is a read-only replica of the leader database. As a result, data in the leader database gets replicated automatically, with low latency, and hence it does not significantly affect the performance of the primary cluster.

## Bulk Copy Demo Scenario

Let's assume that we want to build a web application that displays the latest Covid19 data for Australia. To build the data plane of the application, we require a few components as follows:

1. [Azure Cosmos DB](https://azure.microsoft.com/en-au/services/cosmos-db/): A managed NoSQL database service offering features such as 99.999% availability, geo-replication, and 99th percentile response in less than 10ms, that make it the best choice for an API backend.
2. Covid19 Open Dataset: Azure has a [catalog of open datasets](https://azure.microsoft.com/en-us/services/open-datasets/). One of them is the latest [COVID-19 dataset](https://pandemicdatalake.blob.core.windows.net/public/curated/covid-19/bing_covid-19_data/latest/bing_covid-19_data.json) powering the Bing Covid19 tracker. The dataset is available in several formats: CSV, JSON, JSON-Lines, and Parquet. We will ingest a subset of the columns available in the dataset. Microsoft sponsors the COVID19 open dataset for application developers and researchers that we can use for free.
3. [Azure Data Factory](https://azure.microsoft.com/en-au/services/data-factory/): We will use a Data Factory copy activity to load the Bing Covid19 dataset to Data Explorer and another copy activity to load Australian Covid19 data to the Cosmos DB instance.
4. [Azure Data Explorer](https://azure.microsoft.com/en-au/services/data-explorer/): A service optimized for quickly ingesting large volumes of data and querying them at impressive speed. It is ideal for analyzing large datasets such as IoT telemetry, time-series data, and logs with low latency. Azure Data Explorer is the preferred big data database for data scientists.

Following is the high-level design diagram of the application that presents the connections between the data plane components.

{{< img src="1.png" alt="High-level design" >}}

Let's discuss the steps to build this application (except the web application) next.

## Create Azure Data Explorer/Kusto Cluster

I will use a mix of [AZ CLI commands](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) and the Azure portal UI to create the application. You can use one or the other or follow the instructions as per your preference.

To work with Azure Data Explorer, you will first need to install the kusto (codename of Data Explorer) extension as follows:

```shell
az extension add -n kusto
```

Next, use the following commands to create an Azure Data Explorer/Kusto cluster in a resource group. Please change the name of the cluster to one that is available:

```shell
az group create --location "Central US" --name data-processing-rg

az kusto cluster create `
--location "Central US" `
--cluster-name "covidauadx" `
--resource-group data-processing-rg `
--sku name="Dev(No SLA)_Standard_D11_v2" capacity=1 tier="Basic"
```

Keep the cluster running for as long as you need, but don't forget to stop it to save money. Execute the following command to stop the cluster:

```shell
az kusto cluster stop `
--cluster-name "covidauadx" `
--resource-group data-processing-rg
```

You can restart the cluster when you are ready to develop and debug your application with the following command:

```shell
az kusto cluster start `
--cluster-name "covidauadx" `
--resource-group data-processing-rg
```

Navigate to the Data Explorer instance in the Azure Portal and create a database named **covid-db** to record the Covid data as follows:

{{< img src="2.png" alt="Create database" >}}

Let's now creating a table in the cluster. Select the database from the list and click on the Query button, which will launch the query console. Data Explorer also has a dedicated portal available at [https://dataexplorer.azure.com](https://dataexplorer.azure.com) that you can use to run queries on your Kusto cluster. Execute the following Kusto query on the console to create a table named **Covid19** as follows:

```plaintext
.create-merge table Covid19 (id: int, updated:  datetime, confirmed: int,  confirmed_change: int, deaths: int, deaths_change: int, country_region: string, load_time: datetime)
```

Our Kusto cluster is now ready to ingest the Bing Covid19 dataset. Let's use Azure Data Factory to fetch the dataset and push it to our cluster.

## Connect Azure Data Factory to Azure Data Explorer

Use the following command to create an Azure Data Factory (ADF) instance named **covidau-df** in the **data-processing-rg** resource group:

```shell
az datafactory create `
--location "Central US"`
--name "covidau-df" `
--resource-group data-processing-rg
```

We need to set up a service principal that ADF can use to connect to the Azure Data Explorer cluster. The service principal will help us add Azure Data Explorer as a linked service in the Data Factory. Follow the [instructions in the Microsoft guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal) to create a new service principal and a client secret in your Azure Active Directory. For example, I created a principal named **covid-adx** in my AD as follows. Note down the application secret and the Application ID, which we will require for granting ADF access to the Kusto cluster.

{{< img src="3.png" alt="Record application id and secret" >}}

Navigate to the **covid-db** database you created in the Kusto cluster and click on the **Permissions** option. You can grant **Admin** privileges on the database by clicking through the following options:

{{< img src="4.png" alt="Grant admin privilege to the service principal" >}}

Please assign minimum privileges to the service principal in the production environment.

Let's build an ADF pipeline with a copy activity that copies data from the Bing Covid19 dataset to the table we created in the **covid-db** database.

There are several ways to create an ADF pipeline. You can use the [Azure DevOps pipeline](https://docs.microsoft.com/en-us/azure/data-factory/continuous-integration-deployment) or AZ CLI instructions to set up a Data Factory pipeline. However, we will use the [Data Factory UI](https://adf.azure.com/) to build our pipeline to get visual feedback on our actions. Navigate to the ADF portal and click through the following sequence to start creating a new dataset:

{{< img src="5.png" alt="Create new dataset" >}}

Search for Azure Data Explorer in the list of available datasets. Then, click on the **New** button, and enter the name of the linked service: **Covid AU ADX**. Next, enter the service principal **Application ID** and **secret** in the **Service principal ID** and **Service principal key** fields. Finally, enter the name of the database and click on the **Create** button as follows:

{{< img src="6.png" alt="Create Kusto linked service" >}}

Enter the name of the table (**Covid19**) that you created and the name of the dataset.

{{< img src="7.png" alt="Create Kusto dataset" >}}

We need to create another dataset and linked service for connecting with the Bing Covid19 open data service and fetching the dataset.

## Connect Azure Data Factory to HTTP Linked Service

Create another dataset named **BingCovidODS** and create an HTTP - JSON server linked service named **Covid DS HTTP Server**. An HTTP linked service requires a base URL, which in our case is: [https://pandemicdatalake.blob.core.windows.net/](https://pandemicdatalake.blob.core.windows.net/). Follow the same steps as before to create an HTTP JSON linked service. First, search for _HTTP_ in the list of available linked services, and from the next set of options, select _JSON_.

{{< img src="8.png" alt="HTTP JSON linked service" >}}

Next, enter the relative URL to the dataset in the dataset properties: public/curated/covid-19/bing_covid-19_data/latest/bing_covid-19_data.json

{{< img src="9.png" alt="Covid dataset properties" >}}

We can now create a pipeline that copies data from the **BingCovidODS** dataset to the **covid19_table** dataset.

## Copy Data Between Datasets with Data Factory

Create a new ADF pipeline by selecting the **New pipeline** option from the **Pipeline** section. Next, assign a name to the pipeline and search for copy activity in the list of activities. Then, drag and drop the activity to the designer and give it a name: **Copy covid ODS to covid19_table**.

{{< img src="10.png" alt="Add copy activity to copy BingCovidODS to covid19_table" >}}

In the **Source** tab, select **BingCovidODS** as the source dataset and set the **Request method** to GET because the dataset is available at the GET endpoint.

{{< img src="11.png" alt="Setup source dataset" >}}

In the **Sink** tab, select the **covid19_table** option for the **Sink dataset**.

{{< img src="12.png" alt="Setup sink dataset" >}}

We do not need to translate the names of the columns of the source dataset for ingestion because we kept the column names of the sink dataset the same. However, for custom translations, you can specify the mappings in the **Mapping** tab.

## Create Cosmos DB

To create a Cosmos DB instance, execute the following command:

```shell
az cosmosdb create `
--name "covid-cdb" `
--resource-group data-processing-rg
```

Navigate to the portal and use the **Data Explorer** option to create a new database named **Australia** and a container named **cases** with partition key **/updated** as follows:

{{< img src="13.png" alt="Create database and container" >}}

Let's head back to the ADF pipeline and feed data of Australia to Cosmos DB from the Kusto cluster.

## Create Cosmos DB Linked Service and Dataset

Create another dataset named **covid_au_cdb** and a linked service named **covid_cdb**. Search for **Cosmos DB SQL API** to quickly find the required linked service from the list of available linked services. To configure the linked service, enter the name of the service and the connection string to the database as follows:

{{< img src="14.png" alt="Create Cosmos DB linked service" >}}

Enter the name of the collection - **cases** in the dataset configuration to complete the setup.

{{< img src="15.png" alt="Configure Cosmos DB dataset" >}}

Let's now extend our pipeline to push data specific to Australia to the dataset.

## Copy Data From Azure Data Explorer to Cosmos DB with Azure Data Factory

Create another copy activity named **Copy ADX AU data to Cosmos DB** and link it to the previous activity to execute after the previous activity runs to completion.

In the **Source** tab, set the **covid19_table** as the source data set. Since the dataset is associated with a Kusto cluster, you can enter a query to extract a subset of data from the cluster. Enter the following query in the **Query** field:

```plaintext
Covid19
| where country_region == "Australia"
| order by updated desc
```

Following is the screenshot of the **Source dataset** configuration:

{{< img src="16.png" alt="Configure Source dataset" >}}

Click on the **Sink** tab and select the **Sink dataset** to **covid_au_cdb**. Then, to avoid duplicates in ADF activity reruns, set the **Write behavior** to **Upsert** as follows:

{{< img src="17.png" alt="Configure Sink dataset" >}}

We are now done with the setup. Click on the **Publish all** button to save all the ADF artifacts that you created.

## Running the Data Factory Pipeline

Click on the Debug button on the Pipeline and wait for the activities to run to completion.

{{< img src="18.png" alt="Debugging ADF pipeline" >}}

Let's inspect the data in the Kusto cluster first. Head over to the **Query** section in Azure Data Explorer and enter the following query to fetch the top 10 results.

```plaintext
Covid19
| limit 10
```

The following screenshot presents the result of the query after execution.

{{< img src="19.png" alt="Result of the Kusto query" >}}

Let's now navigate to the Cosmos DB **Data Explorer** and expand the collection to see the items in the **cases** collection as follows:

{{< img src="20.png" alt="Items in the cases collection" >}}

## Conclusion

We should ensure that the downstream data copy operations do not impact the compute workloads of our data platform. We can either share data from storage accounts (no compute) or provision database replicas for bulk data copy. For services in which the compute is coupled with storage, you can build a low-end replica to enable other teams to explore the datasets available in your data platform without impacting other workloads and with a small additional cost.

I hope you enjoyed working through the exercise in this article and learned something new. I borrowed the concept for this exercise from the latest Manning title: [Data Engineering on Azure](https://www.manning.com/books/data-engineering-on-azure).

## My Review of Data Engineering on Azure

[Data Engineering on Azure](https://www.manning.com/books/data-engineering-on-azure) is an excellent book covering data ingestion and storage, all the different workloads a data platform runs, and multiple aspects of data governance. This article is based on one of my favorite sections of the book, which covers how data leaves a data system to be consumed by users or other systems.

This book is full of practical techniques, processes, and patterns that you can apply to your problem space. I enjoyed reading this book and learned a lot from it. Would you mind participating in the giveaway for a chance to win a free copy of the book? Read the note at the beginning of the article.

> **Disclaimer**: I am a Manning content partner and received a free copy of Data Engineering on Azure for review. Manning Publications is the sponsor of the giveaway of the title. I am not bound to give any title favorable reviews under the program.

{{< subscribe >}}
