---
title: "Ditch Your DNS For Microsoft Azure DNS & Moving On"
date: 2016-06-04
tags:
  - azure
  - networking
comment_id: ebc37a90-2a52-489c-9c07-99a33c568c4f
slug: ditch-your-dns-for-microsoft-azure-dns-amp-moving-on
---

This is my last post as Associate Architect at [Nagarro](http://www.nagarro.com/us/en). I would be moving to a new location and a new position very soon and therefore, I won’t be posting much for about a month. I'll have a lot more to say about the new organization that I would be joining once I get there, but for now, let me just say that everyone I've met at this new place has seemed smart and passionate. I'm very excited to join the team. Of course, I would miss the fantastic people at Nagarro and my laptop, which powers at least five of my peripherals at any point of time and helps me write and publish this blog.

## What Else?

There are some interesting things that I am working on and I am sure you would love to be in the loop when they are ready for prime time. I welcome you to [subscribe to my mailing list](#subscribe) and join many others who love coding and trying out new stuff just like you and me.

## Enough.. Let’s Start

Do you know how many name servers are available with your domain registrar and whether they are redundant and highly available? Do you wait for DNS records to update after every deployment? Do you experience latency in the name resolution of your application? If you have faced any or all of these issues, then you would want to explore Microsoft’s [Route 53](https://aws.amazon.com/route53/) a.k.a [Azure DNS](https://azure.microsoft.com/en-in/services/dns/).

## Azure DNS

Let’s get a few facts in place. A DNS is responsible for resolving a website name to its IP address. A domain name registrar is an organization that registers your domain name in the central registry database. The Azure DNS service does not provide domain name registrations (yet), so you would need to use an affiliated domain name registrar such as [GoDaddy](https://www.godaddy.com/) to reserve your domain name. You can then rely upon the global reach of [Microsoft Azure](https://azure.microsoft.com/) to resolve the IP addresses of your domains. I encourage you to read about [DNS internals in this fun little comics](https://howdns.works/).

A DNS server can store a set of DNS records for each domain in a [DNS Zone File](https://en.wikipedia.org/wiki/Zone_file). Each DNS record has a name, [a predefined type](https://en.wikipedia.org/wiki/List_of_DNS_record_types) and a value. Two of the most important records are the `A` record, which maps a name to an IP address and the `CNAME` record, which basically specifies the alias name of the value of the record (e.g. rahulrai.in is the alias of rahulrai.azurewebsites.net).

## Let’s Make It Work

- Create an Azure [WebApp](http://azure.microsoft.com/en-us/services/app-service/web/) in your subscription using at least the Standard pricing tier so that you can do the name mapping. I created one with the name **azurednssite.azurewebsites.net**.
- Head over to a free domain name registrar such as [dottk](http://www.dot.tk/en/index.html) (no personal preference, this was the first link that appeared in my search result). Secure a domain name with the registrar, e.g. **azuredns.tk.** Let your browser tab stay open because we will modify the DNS settings for the domain name that you secured.
- In the Azure portal, create a new instance of Azure DNS in your subscription by clicking on **New > Networking >** and then clicking on **DNS Zone.**
- Click **Create** to open the DNS Zone blade.
- Let’s fill out the values in this blade. You would need to provide a name for the zone (remember Zone File?). This name should be the same as the domain name that you secured. e.g. **azuredns.tk**. The rest of the fields are self-explanatory.

{{< img src="1.png" alt="Create DNS Zone" >}}

- Once the zone has provisioned, click on the provisioned instance to see the list of name servers that contain your zone file.

{{< img src="2.png" alt="DNS Name Servers" >}}

- Head over to your domain name management console and supply your own DNS settings rather than using the DNS servers of the domain registrar. I supplied the names of two of the name servers, however, you can add more.

{{< img src="3.png" alt="Create Custom DNS Records" >}}

- Till now, we have our domain registered in the central registry database and we have instructed the root server to tell the names of name servers to the resolver (read the comic that I previously linked to).
- Now all we need to do is bind the custom domain name that we provisioned earlier to our web application. This is done by:

- Making an **A** record entry in the zone file. This record maps the hostname to the IP address of the web application.
- Making a **CNAME** entry in the zone file to prove our ownership of the domain name.
- Making an entry of the provisioned domain name in the web application.

- To find the IP address to provision the **A** record and the **CNAME** key and value, go to the **Settings** blade of your web app and click on **Custom domains and SSL > Bring External Domains**. Copy the IP address and the verification value of **CNAME** record. See highlighted.

{{< img src="4.png" alt="Getting DNS Records of Web App for Mapping" >}}

- Now move over to your DNS zone and add two DNS records as shown below.

{{< img src="5.png" alt="Add DNS Record" >}}

- Since the provisioning takes effect immediately, you can apply the custom domain name to your web application now. Go to the **Bring External Domains** setting of your application and add the name of the domain that you previously provisioned (**azuredns.tk**) to the list of DNS. Azure will then verify the DNS records to ensure that you are the owner of the domain and apply the domain binding immediately.
- Enjoy browsing your WebApp from your browser.

{{< img src="6.png" alt="Your Web App with Custom Domain" >}}

## Conclusion

It makes sense to take control of your DNS servers. Requests made to a highly available and high-performance application may fail because your DNS registrar’s name servers could not respond in a timely and efficient manner. Moreover, waiting for zone file changes to propagate, impedes agility and may result in inconsistent application behavior for some time. See you in another post!

{{< subscribe >}}
