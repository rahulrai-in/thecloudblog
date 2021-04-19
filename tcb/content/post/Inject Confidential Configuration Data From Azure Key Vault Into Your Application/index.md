---
title: "Inject Confidential Configuration Data From Azure Key Vault Into Your Application"
date: 2016-01-23
tags:
  - azure
  - security & identity
comment_id: 362dd66a-fd82-4a22-ac68-b3d5dbf0fbc4
---

In ASP.NET your site configuration data is normally stored within `<appSettings>` element of the web.config file. If you have used [Azure Web Apps](https://azure.microsoft.com/en-in/documentation/articles/app-service-web-overview/) (this blog is running on one), you must be aware of the fact that the Microsoft Azure Web Apps Service allows for these application settings to be configured within the Azure Web App configurations in the cloud, and then subsequently accessed from application code as needed. You can supply these values through [Azure Web App configurations](https://azure.microsoft.com/en-in/documentation/articles/web-sites-configure/). Note that you still get access to any settings that you provide or override exactly as `AppSettings` contained within the web.config file e.g. through `ConfigurationManager` class. Let’s say goodbye to those messy web.config transforms and letting unintended users know about your application secrets!

Now, if you want to secure the configuration data even more (not visible even in the management portal) or you have an existing application that is deployed on some cloud (including private cloud) and you want to secure the configuration data without altering the manner in which the data is read from the web configuration file, there is a way to do that through [Azure Key Vault](https://azure.microsoft.com/en-in/services/key-vault/).

## What is Azure Key Vault?

Microsoft Azure Key Vault is a cloud-hosted management service that allows users to encrypt keys and small secrets by using keys that are protected by hardware security modules (HSMs). Small secrets are data less than 10 KB such as passwords and .PFX files. An HSM is a secure, tamper-resistant piece of hardware that stores cryptographic keys. The keys can also be imported or generated in HSMs that have been certified to FIPS 140-2 level 2 standards.

## What We Will Build

We will save configuration data in Key Vault and build a settings provider that will enlist and add or override all **app settings** and **connection strings** stored in Key Vault in the configuration settings of the application. The following steps need to be implemented in the given order to achieve the objective.

1.  Provision an application in Azure AD.
2.  Provision an Azure Key Vault account.
3.  Authorize the application configured above to read the secrets.
4.  Build a settings provider.

## Source Code

The code used in this sample is available here. {{< sourceCode src="https://github.com/rahulrai-in/keyvaultappsetting">}}

## Provision an Application in Azure AD

Follow the steps documented [here](https://azure.microsoft.com/en-in/documentation/articles/key-vault-get-started/#register) to configure your application in Azure AD. A friend of mine has documented the various steps for carrying out the steps [here](http://www.rahulpnath.com/blog/authenticating-a-client-application-with-azure-key-vault/). By the end of the steps you should have an **Application Id** and a valid **Application Key**.

{{< img src="1.png" alt="Application Configured In Azure AD" >}}

## Provision An Azure Key Vault Account and Authorize The Application To Read The Secrets

Execute the following script (**SetupKeyVault.ps1**) to provision your Key Vault, add some application secrets to it and allow your application to read secrets from it.

```powershell
#Login to your Azure Account
Login-AzureRmAccount
#Set your subscription as default
Set-AzureRmContext -SubscriptionId #YOUR SUBSCRIPTION ID#
#Create new Resource Group
New-AzureRmResourceGroup –Name 'KeyVaultAppSettingsResources' –Location 'SouthEast Asia'
#Create new Key Vault in the Resource Group
New-AzureRmKeyVault -VaultName 'KeyVaultAppSettings' -ResourceGroupName 'KeyVaultAppSettingsResources' -Location 'SouthEast Asia'
#Add some secrets
$secretValue1 = ConvertTo-SecureString 'Pa$w0rd1' -AsPlainText -Force
$secretValue2 = ConvertTo-SecureString 'Pa$w0rd2' -AsPlainText –Force<
Set-AzureKeyVaultSecret -VaultName 'KeyVaultAppSettings' -Name 'APPSETTING-SecretKey1' -SecretValue $secretValue1
Set-AzureKeyVaultSecret -VaultName 'KeyVaultAppSettings' -Name 'SQLCONNSTR-SecretKey2' -SecretValue $secretValue2
#Grant permission to your application.
Set-AzureRmKeyVaultAccessPolicy -VaultName 'KeyVaultAppSettings' -ServicePrincipalName '#YOUR APPLICATION ID (Provisioned in Azure AD)#' -PermissionsToKeys all -PermissionsToSecrets all
```

## Build A Settings Provider

The last step is to create a module that can read these secrets from Key Vault and add them to the application configuration. Create an MVC or Web Forms project. Create a class named `SettingsProcessor` in the same assembly as your Web Application. Decorate your class with the following attribute which instructs the runtime to execute the `Start` method in `SettingsProcessor` class before the application starts.

```c#
[assembly: PreApplicationStartMethod(typeof(SettingsProcessor), "Start")]
```

Next, write the following code in `Start` method to read secrets from Key Vault and plug it into the application configuration sections according to the prefixes. If the name of secret begins with “APPSETTING”, then the secret goes to  the application setting and if the name of secret begins with “SQLCONNSTR”, then the secret goes to the connection strings section of application configuration. The rest of the code is self explanatory.

```c#
public static void Start()
{
    var keys = KeyVaultHandler.GetKeys();
    foreach (var entry in keys)
    {
        var name = entry.Value;
        var val = KeyVaultHandler.GetValue(entry.Key);

        if (name.StartsWith(SqlServerPrefix, StringComparison.OrdinalIgnoreCase))
        {
            name = name.Substring(SqlServerPrefix.Length);
            SetConnectionString(name, val, "System.Data.SqlClient");
        }
        else if (name.StartsWith(AppSettingPrefix, StringComparison.OrdinalIgnoreCase))
        {
            //// Update AppSettings with new value.
            name = name.Substring(AppSettingPrefix.Length);
            ConfigurationManager.AppSettings[name] = val;
        }
    }
}
```

The complete code of `SettingsProcessor` class is listed below.

```c#
[assembly: PreApplicationStartMethod(typeof(SettingsProcessor), "Start")]

namespace KeyVaultAppSettingWebApp
{
    #region

    using System;
    using System.Configuration;
    using System.Reflection;

    using KeyVaultConfigurationHandler;

    #endregion

    /// <summary>
    ///     Class SettingsProcessor.
    /// </summary>
    public static class SettingsProcessor
    {
        #region Constants

        /// <summary>
        ///     The application setting prefix
        /// </summary>
        private const string AppSettingPrefix = "APPSETTING-";

        /// <summary>
        ///     The SQL server prefix
        /// </summary>
        private const string SqlServerPrefix = "SQLCONNSTR-";

        #endregion

        #region Public Methods and Operators

        /// <summary>
        ///     Starts this instance.
        /// </summary>
        public static void Start()
        {
            var keys = KeyVaultHandler.GetKeys();
            foreach (var entry in keys)
            {
                var name = entry.Value;
                var val = KeyVaultHandler.GetValue(entry.Key);

                if (name.StartsWith(SqlServerPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    name = name.Substring(SqlServerPrefix.Length);
                    SetConnectionString(name, val, "System.Data.SqlClient");
                }
                else if (name.StartsWith(AppSettingPrefix, StringComparison.OrdinalIgnoreCase))
                {
                    //// Update AppSettings with new value.
                    name = name.Substring(AppSettingPrefix.Length);
                    ConfigurationManager.AppSettings[name] = val;
                }
            }
        }

        #endregion

        #region Methods

        /// <summary>
        /// Sets the connection string.
        /// </summary>
        /// <param name="name">The name.</param>
        /// <param name="connString">The connection string.</param>
        /// <param name="providerName">Name of the provider.</param>
        private static void SetConnectionString(string name, string connString, string providerName = null)
        {
            var settings = ConfigurationManager.ConnectionStrings[name];
            settings?.SetData(connString, providerName);
        }

        /// <summary>
        /// Sets the data.
        /// </summary>
        /// <param name="settings">The settings.</param>
        /// <param name="connString">The connection string.</param>
        /// <param name="providerName">Name of the provider.</param>
        private static void SetData(this ConnectionStringSettings settings, string connString, string providerName)
        {
            var readOnlyField = typeof(ConfigurationElement).GetField(
                "_bReadOnly",
                BindingFlags.Instance | BindingFlags.NonPublic);

            readOnlyField.SetValue(settings, false);
            settings.ConnectionString = connString;

            if (providerName != null)
            {
                settings.ProviderName = providerName;
            }
        }

        #endregion
    }
}
```

We will create a helper class named `KeyVaultHandler` that interacts with Key Vault and gets the list of secrets and their values. The complete code of this class is listed below.

```c#
public static class KeyVaultHandler
{
    #region Static Fields

    /// <summary>
    /// The vault name
    /// </summary>
    private static readonly string VaultName = ConfigurationManager.AppSettings["VaultName"];

    /// <summary>
    /// The kv client
    /// </summary>
    private static readonly KeyVaultClient KvClient = new KeyVaultClient(GetToken);

    #endregion

    #region Public Methods and Operators

    /// <summary>
    /// Gets the keys.
    /// </summary>
    /// <returns>Dictionary&lt;System.String, System.String&gt;.</returns>
    public static Dictionary<string, string> GetKeys()
    {
        try
        {
            var result = KvClient.GetSecretsAsync(VaultName).Result;
            return result.Value.ToDictionary(value => value.Id, value => value.Identifier.Name);
        }
        catch (Exception e)
        {
            return null;
        }
    }

    /// <summary>
    /// Gets the value.
    /// </summary>
    /// <param name="key">The key.</param>
    /// <returns>System.String.</returns>
    public static string GetValue(string key)
    {
        try
        {
            return KvClient.GetSecretAsync(key).Result.Value;
        }
        catch (Exception e)
        {
            return null;
        }
    }

    #endregion

    #region Methods

    /// <summary>
    /// Gets the token.
    /// </summary>
    /// <param name="authority">The authority.</param>
    /// <param name="resource">The resource.</param>
    /// <param name="scope">The scope.</param>
    /// <returns>Task&lt;System.String&gt;.</returns>
    /// <exception cref="System.InvalidOperationException">No Key Vault token</exception>
    private static async Task<string> GetToken(string authority, string resource, string scope)
    {
        var authenticationContext = new AuthenticationContext(authority);
        ////Alternatively, use certificate authentication
        var clientCredential = new ClientCredential(
            ConfigurationManager.AppSettings["ClientID"],
            ConfigurationManager.AppSettings["ClientKey"]);
        var result = await authenticationContext.AcquireTokenAsync(resource, clientCredential);
        if (result == null)
        {
            throw new InvalidOperationException("No Key Vault token");
        }

        return result.AccessToken;
    }

    #endregion
}
```

That’s it! Just add your Key Vault name, your client id and client key to web config as application settings to complete the setup. Just to demonstrate that things are working, I displayed the secrets on the landing page of the sample application.

## Output

{{< img src="2.png" alt="AppSetting and ConnectionString from Key Vault" >}}

This works great for applications hosted on any cloud. I hope this sample helps you mitigate some hurdles in migrating your applications to the cloud or gives you a new perspective on securing application configuration data.

{{< subscribe >}}
