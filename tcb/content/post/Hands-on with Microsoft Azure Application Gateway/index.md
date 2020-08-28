---
title: "Hands-on with Microsoft Azure Application Gateway"
date: 2015-11-05
tags:
  - azure
  - networking
comment_id: ebbd6855-0d95-481d-b1ee-c2fc5b0059b5
---

Cloud Architects tasked to lift and shift workloads frequently face some common challenges. Quite frequently they are handed over application dense servers containing applications which were never meant to scale (metal love) and limited budget and time. Not to forget the fact that the communication channel used by the applications was never secured because the applications were previously accessible only over local network (and maybe in house hacking was not a possibility or maybe internet was not invented till then :smile:) and the marketing team sold the idea of a mobile workforce to the customer.

The Cloud Architects are expected to make the applications not only scalable, but also  secure over the wire (SSL Certificates). I personally had to call ARR ([Application Request Routing](http://www.iis.net/downloads/microsoft/application-request-routing)) into play in a few of such scenarios and apply some workarounds and proxies in some others.

[Azure Application Gateway](https://azure.microsoft.com/en-in/documentation/articles/application-gateway-introduction/), which is Load Balancer layer 7, is a modern service that reduces the time to market of your application and fixes many of the issues we noted above. [Azure Application Gateway](https://azure.microsoft.com/en-in/documentation/articles/application-gateway-introduction/) currently supports layer 7 application delivery for HTTP load balancing, cookie based session affinity and SSL offload.

## What is OSI?

Load Balancer layer 7 sounds like science fiction if you are not a little familiar with computer networking. It’s a good time for a little college knowledge recap now. The [OSI (Open Systems Interconnection)](https://en.wikipedia.org/wiki/OSI_model) model was created by the ISO (International Organization for Standardization) to help standardize communication between computer systems. It divides communications into seven different layers, which each includes multiple hardware standards, protocols, or other types of services. Following is a fun representation of the OSI stack (courtesy [9tut.com](http://www.9tut.com/osi-model-tutorial))

{{< img src="1.jpg" alt="OSI 7 Layers 9TUT" >}}

A brief overview of the OSI layers is as follows:

### Layer 1: The Physical Layer

It activates, maintain and deactivate the physical connection. Voltages and data rates needed for transmission are defined in the physical layer. It converts the digital bits into electrical signals.

### Layer 2: Data Link Layer

Data link layer synchronizes the information which is to be transmitted. Error controlling is done at this layer. The encoded data is then passed to the physical layer. Error detection bits are used and errors are also corrected. Outgoing messages are assembled into frames and transmitted. The system then waits for the acknowledgements to be received after the transmission. It sends messages reliably.

### Layer 3: The Network Layer

It routes the signal through different channels to the other end. It acts as a network controller. It decides the route data should take. It divides the outgoing messages into packets and assembles incoming packets into messages for higher levels.

### Layer 4: Transport Layer

It decides whether data transmission should be on parallel paths or single path. Functions such as multiplexing, segmenting or splitting of the data are performed by the transport layer. Transport layer breaks the message (data) into small units so that they are handled more efficiently by the network layer.

### Layer 5: The Session Layer

Session layer manages and synchronizes the conversation between two different applications. Transfer of data from one destination to another are marked as sessions and are resynchronized properly so that the ends of the messages are not cut prematurely and data loss is avoided.

### Layer 6: The presentation Layer

Presentation layer takes care that the data is sent in such a way that the receiver will understand the information (data) and will be able to use the data. Languages (syntax) of the two communicating systems may be different. Under this condition presentation layer plays the role of a translator.

### Layer 7: Application Layer

It is the topmost layer. Manipulation of data (information) in various ways is done in this layer. Transferring of files and distributing the results to the user is also done in this layer. Mail services, directory services, network resource, etc. are services provided by the application layer.

## Layer 4 and Layer 7 Load Balancers

A **layer 4 load-balancer** takes routing decision based on IPs and TCP or UDP ports. It has a packet view of the traffic exchanged between the client and a server which means it takes decisions packet by packet. The layer 4 connection is established between the client and the server. It is really fast, but can’t perform any action on the protocol above layer 4.

A **layer 7 load-balancer** takes routing decision based on IPs, TCP or UDP ports or any information it can get from the application protocol (mainly HTTP). The layer 7 load-balancer acts as a proxy, which means it maintains two TCP connections: one with the client and one with the server. The packets are re-assembled by the time they reach layer 7 so the load balancer can take routing decisions based on the information it can find in the application requests or responses. The processing is not very slow and is usually completed in a few milliseconds.

At layer 7, a load balancer is aware of the application and can use this additional information to make more complex and informed load balancing decisions. Because it operates with protocols such as HTTP, it can use cookies to identify client sessions.  Azure also has a built in [layer 4 load balancer](https://azure.microsoft.com/en-in/documentation/articles/load-balancer-overview/), which you might have already been explicitly specifying in configurations to scale out your applications deployed on [Azure Virtual Machines](https://docs.microsoft.com/en-us/azure/virtual-machines/). In fact, layer 4 load balancer is in play in Azure Application Gateway as well since the endpoint of Azure Application Gateway is itself load balanced by the Azure layer 4 load balancer. Once traffic reaches the Application Gateway through [Azure Load Balancer](https://azure.microsoft.com/en-in/documentation/articles/load-balancer-overview/), it will route the HTTP traffic based on its configuration to a virtual machine endpoint, cloud service endpoint, web app or an external IP address.

{{< img src="2.png" alt="Azure Gateway" >}}

Application Gateway is currently offered in 3 sizes: **Small**, **Medium** and **Large**. To balance load among the various endpoints, Application Gateway probes a configured port (which you specify in **BackendHttpSettings** section) of all the endpoints every thirty seconds. If the response from these endpoints does not lie in the 200-390 range, the endpoint is taken out of the backend pool until the next probe happens. Currently, traffic is distributed only in Round Robin fashion among the healthy endpoints.

## Scenario

We are going to build a sample application which saves session state in memory (making it dependent on infrastructure) and deploy it on two Azure Virtual Machines. We will then configure and use Azure Application Gateway to maintain session affinity and balance load between these deployments.

## Source Code

You can find and use the source code of any applications that I build on [GitHub](https://github.com/rahulrai-in). The source code of this sample application is available here. {{< sourceCode src="https://github.com/rahulrai-in/applicationgateway">}}

Following is a screenshot of the solution structure. The various components of the solution are explained below. Note that you would need Azure PowerShell cmdlets for this demo, which you can download from [here](https://azure.microsoft.com/en-us/downloads/).

{{< img src="3.png" alt="Solution Structure" >}}

1. **ApplicationGateway.Applications.NoScale**: This is an MVC application that we would be deploying on Azure Virtual Machines.
2. **GatewayConfiguration.xml**: This file contains configuration information for Azure Application Gateway.
3. **GatewayCreationScript.ps1**: By executing this script you would be able to create and configure an Azure Application Gateway for the VMs that host your application.

## Build Phase

We’ll start by creating (downloading works better) an application that is not only contrived but also sucks. The applications will save session state in memory (metal love) and respond to your page refreshes with updated session data. We will then create an [Azure Virtual Network](https://azure.microsoft.com/en-in/services/virtual-network/) and create two Azure Virtual Machines which are connected to the Virtual Network within a single Subnet. Next, we will deploy the application on the two Azure Virtual Machines. Finally, we’ll create and configure an Azure Application Gateway and send requests to the VMs through the gateway. Let’s begin.

- Create an MVC application and place the following code in the default view. This code will help identify the server that is serving the request and display the updated session value on every refresh (happens automatically every 5 seconds).

```html
<head>
    <title>Test Application</title>
    <link rel="stylesheet" href="~/Scripts/Style.css" type="text/css" />
    <meta http-equiv="refresh" content="5">
</head>
<body>
    <div>
        <h1>
            Hi,
        </h1>
        <h3>
            I am @Environment.MachineName
        </h3>
        <h5>
            This counter will keep incrementing on every refresh (automatically or triggered by you).
        </h5>
        <div style="width: 100%; text-align: center; font-size: 100px; font-weight: lighter;">
            <h1>
                @{
                if (Session["Counter"] == null)
                {
                Session["Counter"] = 0;
                }

                Session["Counter"] = (int)Session["Counter"] + 1;
                @Html.Label(Session["Counter"].ToString())
                }
            </h1>
        </div>
    </div>
</body>
</html>
```

- In Azure Management Portal create a VNet and a subnet in that VNet named Subnet-1 (gets created by default). Follow the steps mentioned [here](https://azure.microsoft.com/en-in/documentation/articles/virtual-networks-create-vnet-arm-pportal/).
- Create two Windows Server VMs connected to the VNet and enable IIS in them. You can follow the steps mentioned [here](https://docs.microsoft.com/en-us/azure/virtual-machines/network-overview) to create VMs inside the VNet.
- [Enable port 80](https://azure.microsoft.com/en-in/documentation/articles/virtual-machines-set-up-endpoints/) on your VMs and [deploy your site in the VMs](https://azure.microsoft.com/en-us/documentation/articles/virtual-machines-dotnet-create-visual-studio-powershell/).
- Execute **GatewayCreationScript.ps1** script to create an Application Gateway named **noscaleapplicationgateway** in your VNet. Note that there are two configurable variables, **SubscriptionName** (which is the name of your subscription) and **GatewayconfigurationFilePath** (which is the path to **GatewayConfiguration.xml**), for which you should provide values to execute the script successfully. The following commands are responsible for creating the Gateway, configuring it and starting it.

```powershell
$checkGateway = Get-AzureApplicationGateway noscaleapplicationgateway
if($checkGateway -eq $null)
{
    New-AzureApplicationGateway -Name noscaleapplicationgateway -VnetName applicationgatewaynetwork -Subnets("Subnet-1")
}
Get-AzureApplicationGateway noscaleapplicationgateway
#Set Application Gateway Configuration
Set-AzureApplicationGatewayConfig -Name noscaleapplicationgateway -ConfigFile $GatewayconfigurationFilePath
#Start Gateway
Start-AzureApplicationGateway noscaleapplicationgateway
#Verify that gateway is running
Get-AzureApplicationGateway noscaleapplicationgateway
```

- Once the Gateway starts (at which point billing also starts), the **Get-AzureApplicationGateway** command will return a result that looks like the following. Note the **DnsName** field which contains the URL which users can access to interface with the Application Gateway.

{{< img src="4.png" alt="Powershell Result" >}}

## Further

I recommend that you read about the various Azure Application Gateway configuration elements [here](https://msdn.microsoft.com/en-us/library/azure/mt299391.aspx). You can read more about creating an Azure Application Gateway [here](https://azure.microsoft.com/en-in/documentation/articles/application-gateway-create-gateway/).

## Results

Try accessing the Application Gateway URL from different browsers to hopefully hit the different VMs that you deployed (you can keep closing and reopening browsers until you succeed). Your screen .should look similar to the following. Note that I am accessing the Application Gateway URL here.

{{< img src="5.png" alt="Application Gateway In Action" >}}

If you view the cookies now, you would find the secret sauce that is making the Application Gateway tick.

{{< img src="6.png" alt="Application Gateway Cookies" >}}

**ARRAffinity** cookie contains data that helps Azure Application Gateway determine the endpoint to which it should route the request (yes it is ARR under the hood). **ASP.NET_Sessionid** cookie is a standard session cookie that contains session identifier.
I hope that this little utility helps you save some time on your next engagement. As always, you can post your comments to let everyone know how useful this offering proved to you. Cheers!
{{< subscribe >}}
