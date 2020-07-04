---
title: "Origin Authentication and RBAC in Istio with Custom Identity Provider"
date: 2019-11-11
tags:
  - kubernetes
  - service-mesh
---

The concept of access control can be boiled down to two factors: _authentication (AuthN)_ and _authorization (AuthZ)_. While authentication determines the identity of a client based on the data presented to the identity provider (e.g., Google and Microsoft AD), authorization determines whether an authenticated principal may interact with the resource.

I am not going to delve deep into the security architecture of Istio since I have covered this topic in detail in my upcoming **FREE** quick start guide on Istio. If you want to get up and running with Istio without getting overwhelmed by the information available on the internet, feel free to follow me on Twitter, [@rahulrai_in](https://twitter.com/rahulrai_in), and subscribe to this blog to be one of the first ones to access the book on launch.

Istio supports Token-based end-user authentication with JSON Web Tokens or JWT. In terms of Istio, the process of authentication of the end-user, which might be a person or a device, is known as origin authentication. Istio allows you to validate nearly all the fields of a JWT token presented to it. Since JWT is an industry-standard token format, the origin authentication feature of Istio is compatible with OpenID connect providers such as Auth0, Google Auth, and Key Cloak.

To understand origin authentication in detail, we will generate a custom JWT token and discuss the steps involved in granting access to a microservice to a valid user. You should have access to a Kubernetes cluster with Istio installed to work through the demo. For local development, [Docker Desktop for Windows or Mac](https://www.docker.com/products/docker-desktop) is my preferred option. At the time of this writing, I am using Istio v.1.3.2 on Kubernetes v.1.14.7. If the configurations that we discuss here vary for you because of a difference in the versions of Kubernetes or Istio, then you will have to make suitable adjustments.

## Scenario

Our cluster hosts a service that should be only accessible to authenticated users. One of the endpoints of the service named _headers_ should only be accessible to privileged users. To distinguish a privileged user from other authentic users, the identity provider of the application adds a property named _role_ with value _header-reader_ to the payload of the JWT token that it issues to the privileged users. Only the users with a valid token and role set to the value _header-reader_ should be able to access the _headers_ endpoint of the service.

## Source Code

The specifications and source code used for building this demo is available in the following GitHub repository.

{{< sourceCode src="https://github.com/rahulrai-in/custom-token-istio-auth" >}}

Let’s now proceed with deploying our service to the mesh.

## Deploying Service Without RBAC

For this demo, we will use the containerized version of a popular HTTP request and response service from Postman called [HTTPBin](https://httpbin.org/) as the service that we intend to secure. The source code and documentation of this service are available in this [GitHub repository](https://github.com/postmanlabs/httpbin). To gain familiarity with the HTTPBin service, try hosting it in a Docker container using this [container image](https://hub.docker.com/r/kennethreitz/httpbin/) and send a few HTTP requests to it.

Use the following specification to deploy the HTTPBin service to your Kubernetes cluster and expose it to the internet using an Istio ingress gateway.

```
apiVersion: v1
kind: Namespace
metadata:
  name: safe-services-ns
  labels:
    istio-injection: enabled
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: safe-deployment-v1
  namespace: safe-services-ns
spec:
  selector:
    matchLabels:
      app: httpbin
  template:
    metadata:
      labels:
        app: httpbin
        version: "1"
    spec:
      containers:
        - name: httpbin
          image: kennethreitz/httpbin
          imagePullPolicy: IfNotPresent
          resources:
            limits:
              cpu: 200m
              memory: 200Mi
            requests:
              cpu: 100m
              memory: 100Mi
          ports:
            - name: http-httpbin
              containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: httpbin-service
  namespace: safe-services-ns
spec:
  selector:
    app: httpbin
  ports:
    - name: http-httpbin-service
      port: 80
      targetPort: http-httpbin
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: httpbin-vservice
  namespace: safe-services-ns
spec:
  hosts:
    - "*"
  gateways:
    - httpbin-gw
  http:
    - route:
        - destination:
            host: httpbin-service
            port:
              number: 80
---
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: httpbin-gw
  namespace: safe-services-ns
spec:
  selector:
    istio: ingressgateway
  servers:
    - port:
        number: 80
        name: http-httpbin-gw
        protocol: HTTP
      hosts:
        - "*"
```

As evident from the specification, the virtual service _httpbin-vservice_ is responsible for directing the traffic that it receives from the gateway transparently to the service _httpbin-service_. Let&#39;s apply the specification to our cluster by executing the following command from our terminal.

```bash
$ kubectl apply -f httpbin-service-no-rbac.yml

namespace/safe-services-ns created
deployment.apps/safe-deployment-v1 created
service/httpbin-service created
virtualservice.networking.istio.io/httpbin-vservice created
gateway.networking.istio.io/httpbin-gw created
```

Currently, no access control policies are in effect and therefore, you can access the API without any restrictions. Execute the following command from your terminal to send a request to the _headers_ endpoint of the API.

```bash
$ curl localhost/headers

"headers": {
  "Accept": "*/*",
  "Content-Length": "0",
  "Host": "localhost",
  "User-Agent": "curl/7.55.1",
  "X-B3-Parentspanid": "b90511cb0bb3701c",
  "X-B3-Sampled": "0",
  "X-B3-Spanid": "151dce6f7e64e14b",
  "X-B3-Traceid": "f48544c6eb1c0d8bb90511cb0bb3701c",
  "X-Envoy-Internal": "true"
}
```

Note that Docker Desktop exposes the gateway, _istio-ingressgateway,_ at the address _localhost:80_ (or 127.0.0.1). The IP address of the ingress gateway may vary based on your choice of Kubernetes hosts such as minikube, AKS, and EKS. To find the external IP address of ingress gateway on your host, execute the following command.

```bash
$ kubectl get svc istio-ingressgateway -n istio-system

NAME                   TYPE           CLUSTER-IP     EXTERNAL-IP   PORT(S)
istio-ingressgateway   LoadBalancer   10.110.10.37   localhost     15020:30749/TCP,80:31380/TCP
```

The output of the previous command presents the external IP and ports on which you can communicate with the ingress gateway.

## Publish JWKS

The following diagram presents the high-level workflow of authenticating a client with an external identity provider such as Google Auth to grant access to a secure service.

{{< img src="1.png" alt="Identity Flow in Istio" >}}

Let's visit each of the steps outlined in the diagram.

1. The client requests the identity provider such as Azure AD, and Google to issue it a JWT. On receiving the request, the identity provider generates a JWT and signs it with its private key and returns the token to the client.
2. The client attaches the JWT that it received with the service request and sends it to service. The proxy intercepts the request and uses the public key of the identity provider to validate the token. It then validates whether the authenticated principal is authorized to access the service.
3. The proxy sends the request to the service.

Each JWT carries a signature that can be verified for legitimacy by the proxy using the corresponding public key of the private key used to sign the token. The standard procedure of sharing public keys of JWT issued by an identity provider to the server is to publish them on an API endpoint accessible to the server in the JSON Web Key Set (JWKS) format.

The JWKS endpoint is a read-only endpoint that represents a list of JWKs. A JWK or JSON Web Key is a JSON object that contains the cryptographic public key and other properties of the key. You can read more about the syntax of JWK and JWKS in the [IETF RFC spec here](https://tools.ietf.org/html/rfc7517).

The following are the JWKS endpoints of Microsoft and Google:

- Google: [https://www.googleapis.com/oauth2/v3/certs](https://www.googleapis.com/oauth2/v3/certs)
- Microsoft: [https://login.microsoftonline.com/common/discovery/keys](https://login.microsoftonline.com/common/discovery/keys)

To generate a JWK that we can use to publish JWKS, you can use one of the several command-line tools, libraries, and node packages available online. Since we require asymmetric encryption of token signature so that Istio proxy can validate the JWT signature with the public key of the cryptography key pair, we will use the RSA algorithm for encryption. We will follow the following workflow to generate valid RSA keys and JWK.

1. Generate an RSA private key using an SSL tool such as [OpenSSL](https://www.openssl.org/).
2. Generate an RSA public key from the private key that you generated in the previous step.
3. Generate a JWK from the RSA private key. We will use a node package named [pem-jwk](https://www.npmjs.com/package/pem-jwk) that can translate a PEM file to a JWK file. Just for reference, a PEM file is a file that can contain the public key and the private key of a certificate.
4. Create a JWKS using only the public key attributes of the JWK that you created in the previous step.

In the source code of this application, you will find a folder named [_generate-jwk_](https://github.com/rahulrai-in/custom-token-istio-auth/tree/master/generate-jwk), which contains a shell script named _run.sh_ that can carry out the first three steps of the workflow that we just discussed. The following code listing presents the commands present in the script along with inline comments that describe the purpose of each command.

```bash
npm i && # installs the pem-jwk node package
openssl genrsa 2048 >private.pem && # generates an RSA private key with length of 2048 bits and stores the key in a file named private.pem
openssl rsa -in private.pem -outform PEM -pubout -out public.pem && # generates public key from the private key and stores it in a file named public.pem
cat private.pem | npm run pem >private.jwk &&  # converts the RSA private key to JWK and directs the output to a file named private.jwk
echo 'done!'
```

Let's now execute the shell script using the following command. I use Ubuntu on Widows Subsystem for Linux (WSL) on my machine to execute shell scripts on Windows, however, you can use other tools such as Git Bash for Windows to execute shell scripts as well.

```bash
sh run.sh
```

The following screenshot presents the output generated from executing the previous script on my system.

{{< img src="2.png" alt="Output of run.sh" >}}

The execution of the shell script generates a JWK in a file named _private.jwk_. The only fields of the JWK that we require in our public JWKS are the key type (_kty_) whose value is RSA, the RSA public key modulus value (_n_), and the RSA public key exponent value (_e_). Copy the three values and paste them in the file named _jwks.json_ that is present at the root of the repository. The file _jwks.json_ contains the JWKS that we intend to expose to the Istio proxy for authentication, and therefore, we need to upload the file to a publicly accessible location. For this sample, I am going to use the raw [GitHub location](https://raw.githubusercontent.com/rahulrai-in/custom-token-istio-auth/master/jwks.json) of the _jwks.json_ file so that Istio proxy can easily access it.

## Enable AuthN

Let's lock down our service with an authentication policy so that it does not accept requests that don't carry a valid JWT token. Following is the specification of the authentication policy that we will apply to our cluster.

```
apiVersion: authentication.istio.io/v1alpha1
kind: Policy
metadata:
  name: httpbin-authn-policy
  namespace: safe-services-ns
spec:
  targets:
    - name: httpbin-service
  origins:
    - jwt:
        issuer: "thecloudblog.net"
        audiences: ["app.thecloudblog.net"]
        jwksUri: "https://raw.githubusercontent.com/rahulrai-in/custom-token-istio-auth/master/jwks.json"
  principalBinding: USE_ORIGIN
```

The previous policy instructs the proxy to verify the issuer (_iss_), and audience (_aud_) field of the received JWT before forwarding the request to our service _httpbin-service_. I have also specified the location of the JWKS document that we created previously as the value of the _jwksUri_ field. Apply the previous configuration to the cluster with the following command.

```bash
$ kubectl apply -f authn-policy.yml

policy.authentication.istio.io/httpbin-authn-policy created
```

If you try to send a request to the service now without a valid token, you will receive an unauthorized response.

```bash
$ curl localhost/ip -v

*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 80 (#0)
> GET /ip HTTP/1.1
> Host: localhost
> User-Agent: curl/7.55.1
> Accept: */*

< HTTP/1.1 401 Unauthorized
< content-length: 29
< content-type: text/plain
< date: Wed, 06 Nov 2019 04:48:50 GMT
< server: istio-envoy
< x-envoy-upstream-service-time: 0

Origin authentication failed.* Connection 0 to host localhost left intact
```

Let's now generate a valid token that we can use to make a successful request.

## Generating a Token

Although there are many libraries available for generating JWT tokens, I prefer to use the online JWT generator [JWT.io](https://jwt.io/) for a one-off token generation or to validate an existing token without parsing it programmatically. Let's head over to the website [JWT.io](https://jwt.io/) and create a new token by following these instructions.

1.  Set the algorithm to RS256.
2.  Change the payload to the following JSON code. Remember that we are only validating the issuer and audience fields of the payload, therefore, those are the only required fields in the payload.

    ```json
    {
      "iss": "thecloudblog.net",
      "aud": "app.thecloudblog.net"
    }
    ```

3.  Replace the text in the public key input field with the key present in the file _public.pem_ that was generated by executing the JWK generator script.
4.  Replace the text in the private key input field with the key present in the file _private.pem_.

The following screenshot illustrates the previous workflow in action. After adding the values to the relevant fields, JWT.io will generate a JWT for you to use.

{{< img src="3.png" alt="Generate Valid JWT" >}}

Let's copy the token and save it in a file named _authN-headers.txt_ in the following format. Replace the placeholder text {TOKEN} with the actual token value that you copied from the website.

```bash
Authorization: Bearer {TOKEN}
```

We will now send another HTTP request to our API that includes an authorization header read from the file that we just created. From your terminal, change to the directory where you created the header file and execute the following command.

```bash
$ curl localhost/headers -v -H @authN-headers.txt

*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 80 (#0)
> GET /headers HTTP/1.1
> Host: localhost
> User-Agent: curl/7.55.1
> Accept: */*
> Authorization: Bearer eyJhbGciOiJSUzI1NiIs…
>
< HTTP/1.1 200 OK
< server: istio-envoy
< date: Sun, 10 Nov 2019 00:58:25 GMT
< content-type: application/json
< content-length: 820
< access-control-allow-origin: *
< access-control-allow-credentials: true
< x-envoy-upstream-service-time: 9
<
{
  "headers": {
    "Accept": "*/*",
    "Authorization": "Bearer eyJhbGciOiJSUzI1NiIs…",
    "Content-Length": "0",
    "Host": "localhost",
    "User-Agent": "curl/7.55.1",
    "X-B3-Parentspanid": "a4cd0617db9d27b6",
    "X-B3-Sampled": "0",
    "X-B3-Spanid": "f6bbfd5f56ef8c29",
    "X-B3-Traceid": "943e7101816134e2a4cd0617db9d27b6",
    "X-Envoy-Internal": "true"
  }
}
* Connection #0 to host localhost left intact
```

The output of the previous command shows how Istio intercepts a request and carries out the authentication checks before allowing the request to reach the destination service. Try to execute the previous command with a different token that does not meet the issuer and audience constraints which should return an unauthorized response from the Istio proxy.

## Enable AuthZ

Let's now enable RBAC on our service such that only the principal with the role _header-reader_ can access the endpoint. Configuring RBAC in Istio requires creating two objects as follows.

1. **ServiceRole** : This object determines the set of actions that can be performed on a set of services by an authorized principal\user.
2. **ServiceRoleBinding** : This object associates a role to the principal.

You can enable RBAC on all services within the cluster. However, such operation may disrupt ongoing operations, and therefore, a more appropriate migration strategy is to enable RBAC on a namespace or a service such that any communication with the service or every service in the namespace requires RBAC. The following specification enables RBAC only on the _httpbin-service_.

```
apiVersion: rbac.istio.io/v1alpha1
kind: RbacConfig
metadata:
  name: default
  namespace: istio-system
spec:
  mode: ON_WITH_INCLUSION
  inclusion:
    services:
      - httpbin-service.safe-services-ns.svc.cluster.local
```

Next, we will define a ServiceRole named _header-reader_ that will grant principal access to the _headers_ endpoint of our service.

```
apiVersion: rbac.istio.io/v1alpha1
kind: ServiceRole
metadata:
  name: header-reader
  namespace: safe-services-ns
spec:
  rules:
    - services:
        - httpbin-service.safe-services-ns.svc.cluster.local
      paths:
        - '/headers'
```

Finally, we will bind the ServiceRole to request attributes with ServiceRoleBinding with the following specification.

```
apiVersion: rbac.istio.io/v1alpha1
kind: ServiceRoleBinding
metadata:
  name: header-reader-binding
  namespace: safe-services-ns
spec:
  subjects:
    - properties:
        request.auth.claims[role]: "header-reader"
  roleRef:
    kind: ServiceRole
    name: header-reader
```

The previous specification will instruct Istio to read the claim named _role_ from the principal created from the JWT token, and if its value matches the text _header-reader,_ then assign the principal the role _header-reader_ that we defined previously.

Let's apply these settings to the cluster using the following command.

```bash
$ kubectl apply -f authz-policy.yml

rbacconfig.rbac.istio.io/default created
servicerole.rbac.istio.io/header-reader created
servicerolebinding.rbac.istio.io/header-reader-binding created
```

Let's now try to execute the previous HTTP request again without altering the existing JWT token.

```bash
$ curl localhost/headers -v -H @authN-headers.txt

*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 80 (#0)
> GET /headers HTTP/1.1
> Host: localhost
> User-Agent: curl/7.55.1
> Accept: */*
> Authorization: Bearer eyJhbGciOiJSUzI1NiIs…
>
< HTTP/1.1 403 Forbidden
< content-length: 19
< content-type: text/plain
< date: Sun, 10 Nov 2019 03:24:37 GMT
< server: istio-envoy
< x-envoy-upstream-service-time: 0
<
RBAC: access denied* Connection #0 to host localhost left intact
```

Let's now generate another token from JWT.io by following the same steps that we followed earlier for generating an authentication token. However, this time, we will use the following payload content for generating the token.

```json
{
  "iss": "thecloudblog.net",
  "aud": "app.thecloudblog.net",
  "role": "header-reader"
}
```

The following is a screenshot of the token generation process with the change highlighted.

{{< img src="4.png" alt="Generate a Valid JWT with Role" >}}

Just like we did earlier, we will save the token in a text file named _authZ-headers.txt_ and execute the following command to invoke the _headers_ endpoint with the new header.

```bash
$ curl localhost/headers -v -H @authZ-headers.txt

*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 80 (#0)
> GET /headers HTTP/1.1
> Host: localhost
> User-Agent: curl/7.55.1
> Accept: */*
> Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5c…
>
< HTTP/1.1 200 OK
< server: istio-envoy
< date: Sun, 10 Nov 2019 03:33:50 GMT
< content-type: application/json
< content-length: 850
< access-control-allow-origin: *
< access-control-allow-credentials: true
< x-envoy-upstream-service-time: 1
<
{
  "headers": {
    "Accept": "*/*",
    "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5c… ",
    "Content-Length": "0",
    "Host": "localhost",
    "User-Agent": "curl/7.55.1",
    "X-B3-Parentspanid": "12a0c8bc16a05efe",
    "X-B3-Sampled": "0",
    "X-B3-Spanid": "01de8f54b4c98b6b",
    "X-B3-Traceid": "37dc9ea702c8638f12a0c8bc16a05efe",
    "X-Envoy-Internal": "true"
  }
}
* Connection #0 to host localhost left intact
```

Next, try replacing the value of the payload attribute _role_ with some other value and compare the response with what you just received.

## Summary

Istio supports integration with OpenID connect providers that can issue JWT tokens to authenticated users (persons or systems) so that only authorized users can access the services in the mesh. RBAC policies can encompass the whole mesh, or they can be scoped to an HTTP verb on an endpoint, which grants the developers absolute control over access to the services. Moreover, configuring access control does not require making any changes to the underlying application.

I have covered the topic of authentication policies in Istio in detail in my upcoming FREE title on Istio. This article is an extension of the same topic. If you want to be among the first ones to know about the launch of the book, subscribe to this blog and follow me on Twitter [@rahulrai_in](https://twitter.com/rahulrai_in).

{{< subscribe >}}
