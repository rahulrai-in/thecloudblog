---
title: "Integrating Azure Machine Learning With Azure Stream Analytics to Predict Customer Churn"
date: 2016-05-10
tags:
  - azure
  - machine learning
  - internet of things
comment_id: 6f3e1a90-5934-40b5-be42-5fae2ad732dd
---

I covered building IoT Analytics Architecture prototype authored by [David Crook](https://channel9.msdn.com/Niners/DrCrook) from Microsoft in one of my [previous posts](/post/building-the-azure-iot-analytics-architecture-prototype). David graciously provided some great feedback on the architecture model and asked me to explore yet another aspect of his architecture, that is to take intelligent decisions on the streams of incoming data based on [Azure Machine Learning](https://azure.microsoft.com/en-in/services/machine-learning/) based predictive models. In this post, let's see how we can integrate MAML with Stream Analytics and extend David's IoT analytics architecture.

Businesses need to have an effective strategy for managing [customer churn](https://en.wikipedia.org/wiki/Customer_attrition) because it costs more to attract new customers than to retain existing ones. Customer churn can take different forms, such as switching to a competitor's service, reducing the time spent using the service, reducing the number of services used, or switching to a lower-cost service. Companies in the retail, media, telecommunication, and banking industries use churn modeling to create better products, services, and experiences that lead to a higher customer retention rate.

Delving deep into Machine Learning is out of scope for this post. I recommend that you read [Predictive Analytics with Microsoft Azure Machine Learning](http://www.apress.com/9781484204467) by **Apress** to get an overview of Azure ML. In this post, we will build a small MAML experiment, publish the experiment as a web service, integrate the web service with a Stream Analytics job, and test the application.

## Building The Azure ML Experiment

There are custom templates available in the [Cortana Gallery](https://gallery.cortanaintelligence.com/) to build real life customer churn experiments such as [this one](https://gallery.cortanaintelligence.com/Experiment/Telco-Customer-Churn-5 "Customer Churn") that uses data from the [KDD tournament](http://www.kdd.org/kdd-cup/view/kdd-cup-2009/Data). However, for the purpose of demonstration, I will build a simple and contrived experiment that just works. I would not be walking you through the MAML dashboard. You can easily learn about the various steps involved in building a predictive experiment in the walk-through documented [here](https://azure.microsoft.com/en-us/documentation/articles/machine-learning-walkthrough-develop-predictive-solution/).

## The Dataset

I built a dataset named **CustomerChurnDataset**, which is a CSV file with the following values that I repeated about 100 times.

{{< img src="1.png" alt="ML Dataset" >}}

I deliberately created a pattern in the dataset for our experiment. According to the pattern, customers in their 20's churn (value 0) from the provider services, whereas those in their 30's do not (value 1). I uploaded this dataset to my ML workspace.

## The Experiment

Once the data is in place, we can build our ML experiment. Create a new experiment in your ML workspace that consists of the following modules and connections.

{{< img src="2.png" alt="Customer Churn Experiment" >}}

The experiment works as follows. The dataset first passes through the **Split Data** module which divides the data into training and test data. The first output of the **Split Data** module that contains 90% (0.9 fraction of rows) of the data connects to the **Train Model** module and is used for training the model. The other 10% of the data is passed to the **Score Model** module that is used for scoring the predictions of the model.

There are several algorithms available in MAML for [binary classification](https://azure.microsoft.com/en-in/documentation/articles/machine-learning-basics-infographic-with-algorithm-examples/). I picked one of the algorithm modules, [Two-Class Boosted Decision Tree](https://msdn.microsoft.com/en-us/library/azure/dn906025.aspx) module, that does that. The **Train Model** module trains the model to predict the values of _Churn_ column of the dataset. Following is the property window snapshot of the **Train Model** module.

{{< img src="3.png" alt="Train Model Properties" >}}

Once you run the experiment in your workspace, you can visualize the predictions made by the experiment by clicking on the circle below the **Score Model** module and selecting _Visualize_ from the list.

{{< img src="4.png" alt="Visualize Score Model" >}}

## Deploy The Experiment As Web Service

Once your experiment is ready, click on **Set Up Web Service** in the options menu and select **Predictive Web Service (Recommended)** from the menu options. Once you do that, your experiment will be copied to a new experiment. It will then be modified and a web service input and a web service output endpoint will be added to the experiment.

{{< img src="5.png" alt="ML Web Service" >}}

**Run** the experiment at this point of time so that you can publish it. Once the experiment run has successfully completed, select **Deploy Web Service** option from the options menu. Upon successful deployment, you will be presented with your web service dashboard that lists your _OAuth_ key and other helpful information that you can use to access your web service. Let's use the **Test** button to test our web service now.

{{< img src="6.png" alt="Test ML Web Service" >}}

Let's input a test value with high churn probability to the service, i.e. a consumer of age 21 some other values.

{{< img src="7.png" alt="Azure ML Service Input" >}}

Once the service call is complete, you will find the following output at the bottom of the dashboard.

{{< img src="8.png" alt="Azure ML Service Test Output" >}}

The result shows that for the input, the service calculated the churn as 1 or true (**Scored Label**) with a probability of 0.95.

## Connecting Azure ML and Stream Analytics

Create a new Stream Analytics job ([how](https://azure.microsoft.com/en-in/documentation/articles/stream-analytics-get-started/#create-stream-analytics-job)) named **CustomerChurnJob**. Click on the job and select **Functions** from the menu.

{{< img src="9.png" alt="Azure ML Functions" >}}

Select **Add a Machine Learning Function** and populate the values in the dialog window that follows. Set the function alias name as **predictchurn**.

{{< img src="10.png" alt="Add Azure ML Function" >}}

If the ML service that you previously provisioned is outside your subscription, you would need to specify the service URL and the Authorization Key specified in the API Help Page of your ML Service.

## Setting Up The Input and The Output of The Stream Analytics Job

Although I wanted to serve a continuous data stream to the stream analytics job by connecting it to Event Hub or IoT Hub, to keep the sample brief and to the point, let's serve it static test data from blob storage. Setup Blob Storage as Input of the Stream Analytics Service ([how](https://azure.microsoft.com/en-in/documentation/articles/stream-analytics-define-inputs/#create-a-blob-storage-data-stream-input)) so that files from container named **data** serve as input to the function. Set the input alias name as **input**.

{{< img src="11.png" alt="Add Blob Storage as Input" >}}

Since the test file that we are going to use will be a CSV with headers, we will set the required properties in the next step of adding Blob Storage Input.

{{< img src="12.png" alt="Set Blog Storage Properties" >}}

Similarly, setup Blob Storage as Output of the Stream Analytics job ([how](https://azure.microsoft.com/en-in/documentation/articles/stream-analytics-define-outputs/#blob-storage)) so that the output of the job is saved in a container named **output**. Set the output alias name as **output**.

Now let's write a query that fetches data from the storage container, executes the function that we just configured and directs the output of the query to the storage container. Select **Query** from the top menu and write the following query in the query editor.

```SQL
WITH subquery AS (
    SELECT predictchurn(Age, CallsPerMonth, InternetUsageInMbPerMonth, Churn) AS result FROM input)
SELECT result.[Age], result.[CallsPerMonth], result.[InternetUsageInMbPerMonth], result.[Scored Labels], result.[Scored Probabilities]
INTO output
FROM subquery
```

Click on the **Start** button in the bottom menu to start the job and wait for the job to get in running state.

## Executing The Sample

Use the [Microsoft Azure Storage Explorer](http://storageexplorer.com/) tool to upload a test file to your storage account that you configured as input for the Stream Analytics job. You can create a test file yourself with tools such as Microsoft Excel. Just make sure that the names of the headers are consistent with the parameters that we passed to the function that we provisioned in the Stream Analytics job. Following is the snapshot of the test file that I used for testing the sample.

{{< img src="13.png" alt="Customer Churn Test File" >}}

I uploaded this file to the input container.

{{< img src="14.png" alt="Test Data in Input" >}}

Soon after the upload, the Stream Analytics job kicked in and started processing the data.

{{< img src="15.png" alt="CustomerChurnJob" >}}

The output of the job was saved in the target container.

{{< img src="16.png" alt="Output Data in Output" >}}

The file contained the **scored labels** (expected churn value) and the probability of accuracy of the score.

{{< img src="17.png" alt="Result File" >}}

This is a powerful feature of Stream Analytics through which intelligent decisions can be taken on a continuous stream of data. For example, for this very scenario, if the telecommunication companies run analytics on a stream of telephone call data, then they can predict customer satisfaction and take corrective actions even before customers plan on opting out of operator services. I hope that this blog is fun to read and proves helpful. As always, do provide your feedback and comments in the comments section below! Thank you!

{{< subscribe >}}
