---
title: Managing GitHub Organizations with GitHub GraphQL API
date: 2021-02-18
tags:
  - web
  - programming
comment_id: cd9aae53-507f-403a-a857-fb2280587353
---

I prefer using GraphQL over REST APIs wherever available, primarily because I can avoid [overfetching and underfetching data](https://www.howtographql.com/basics/1-graphql-is-the-better-rest/) while still enjoying the benefits of contract-based development.

For this exercise, assume that you are the DevOps lead of an organization/open-source community that uses GitHub to manage its projects under a GitHub Organization. [GitHub Organizations](https://docs.github.com/en/github/setting-up-and-managing-organizations-and-teams/about-organizations) are shared accounts consisting of members and projects with sophisticated security and administrative features. You have been asked to ensure that your organization's repositories are healthy such that there are no PRs in an unmerged state for more than one week, and every issue is either resolved or updated in 12 hours.

GitHub has an excellent [GraphQL API](https://docs.github.com/en/graphql) that allows you to query and perform operations against repositories, users, issues, etc. You can download the [GraphQL API schema](https://docs.github.com/en/graphql/overview/public-schema) and load it in tools such as [GraphQL playground](https://studio.apollographql.com/) to issue requests to the GitHub GraphQL API endpoint: <https://api.github.com/graphql>.

You will require a Personal Access Token to authenticate your requests to the GraphQL API. You can visit the [Developer Settings section](https://github.com/settings/tokens) of the GitHub settings page to create a new Personal Access Token. For more information about the token generation process, please visit the [GitHub help website](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).

{{< img src="1.png" alt="Create a personal access token" >}}

To authorize an API request, add the following authorization header to the HTTP request.

```json
"Authorization": "Bearer PAT_TOKEN"
```

Replace the placeholder `PAT_TOKEN` with the access token that you generated earlier.

With the basics out of the way, let's write a simple .NET Core console application that uses the GitHub GraphQL API to fetch open issues from a GitHub repository and use a [mutation operation](https://graphql.org/learn/queries/) to automatically post a comment to stale open issues asking the team to update the issue.

## Source Code

The following GitHub repository hosts the source code of the sample application:

{{< sourceCode src="https://github.com/rahulrai-in/gh-graphql-client" >}}

> **Tip**: Please do not abuse the GitHub APIs to spam public GitHub repositories. It is a nuisance to the community and might get you banned.

## GitHub GraphQL Client

The most popular client library for consuming GraphQL services in .NET Core applications is [GraphQL.Client](https://github.com/graphql-dotnet/graphql-client). Install the library as a NuGet package in your project. Let's now prepare a GraphQL client that we will use to perform queries and mutations on the GitHub GraphQL API as follows:

```cs
var token = Console.ReadLine();
var httpClient = new HttpClient();
httpClient.DefaultRequestHeaders.Authorization =
    new AuthenticationHeaderValue("Bearer", token);
var gqlOptions = new GraphQLHttpClientOptions { EndPoint = new Uri("https://api.github.com/graphql") };
var gqlClient = new GraphQLHttpClient(gqlOptions, new SystemTextJsonSerializer(), httpClient);
```

We prepared an HTTP client to set the authorization header in the GraphQL API requests. Next, we set the URL of the GraphQL API endpoint and prepared the `GraphQLHttpClient` to use in the query and mutation operations.

## GraphQL Query: Fetch Open Issues

Upon execution, the following code will fetch all open issues created in a repository. Since the [Repository API](https://docs.github.com/en/graphql/reference/queries#repository) does not currently support fetching issues that have not been updated since a given date, we will filter the issues that have not been updated in the last 12 hours after fetching them. Since we are only dealing with a subset of issues in a repository, paging is not a significant concern for this sample. However, for queries that might return many results, the API supports cursors (page identifier) and `first` and `last` arguments to fetch subsets of the result.

```cs
async Task<List<Node>> GetOpenIssuesInRepoPastThreshold(string repository)
{
    var issueStalenessFilter = DateTime.UtcNow - TimeSpan.FromHours(12);
    var request = new GraphQLRequest
    {
        Query =
            @"query GetOpenIssuesPastThreshold($repositoryName: String!, $repositoryOwner: String!, $issuesStates: [IssueState!], $issuesFirst: Int) {
                  repository(name: $repositoryName, owner: $repositoryOwner) {
                    issues(states: $issuesStates, first: $issuesFirst) {
                      nodes {
                        id
                        updatedAt
                        url
                      }
                    }
                  }
            }",
        Variables = new
        {
            repositoryName = repository,
            repositoryOwner = "rahulrai-in",
            issuesStates = "OPEN",
            issuesFirst = 100
        }
    };

    var response = await gqlClient.SendQueryAsync<Root>(request);
    return response?.Data?.Repository?.Issues?.Nodes.Where(n => n.UpdatedAt < issueStalenessFilter)
        .ToList();
}
```

Please change the value of the `repositoryOwner` variable to the name of the organization or the user (yourself). Let's now discuss how you can use the API to post comments on the open issues.

## GraphQL Mutation: Comment on Open Issues

The GitHub GraphQL API supports several [mutation operations](https://docs.github.com/en/graphql/reference/mutations) to change data on the server. We will use the [`addComment` mutation](https://docs.github.com/en/graphql/reference/mutations#addcomment) to add a comment to the issue.

In the GitHub API, elements such as issues, pull requests, and users are nodes. Nodes are connected to other nodes through edges. In our example, the issue is a node, and it is connected to a comment node through an edge called `commentEdge`. Both the nodes and edges contain information that you can fetch.

```cs
async Task<Node> CommentOnIssue(string openIssueId)
{
    var request = new GraphQLRequest
    {
        Query =
            @"mutation AddCommentMutation($addCommentInput: AddCommentInput!) {
                  addComment(input: $addCommentInput) {
                    commentEdge {
                      node {
                        url
                      }
                    }
                  }
            }",
        Variables = new
        {
            addCommentInput = new
            {
                body =
                    "This issue has breached the Stale Issue policy. Please close this issue or update this conversation to inform the parties about the latest status of the fix.",
                subjectId = openIssueId
            }
        }
    };

    var response = await gqlClient.SendQueryAsync<Root>(request);
    return response?.Data?.AddComment?.CommentEdge?.Node;
}
```

We fetched the id of the issue node in our previous query. Set the value of the `subjectId` variable to the node id of the issue so that GitHub can link your comment to the issue. You might have guessed already that the value of the `body` variable is the message that you want to post as the comment.

## Tests

Let’s test our implementation now. In preparation for the demo, I created some GitHub issues that are now stale (inactive for more than 12 hours).

{{< img src="2.png" alt="Stale issues in repository" >}}

Let’s execute the application and allow it to act on our repository. Paste your GitHub Personal Access Token when asked to do so and press the enter key.

{{< img src="3.png" alt="Execute the application" >}}

The application discovered the stale issues in our repository and posted comments on the issues. You must have noticed the richness of the response from the APIs. We fetched the URLs of the issues and the comments without making any additional HTTP calls, unlike REST.

Let’s now view the issue in GitHub to view the comments posted by our application.

{{< img src="4.png" alt="Auto posted comments" >}}

If you try to execute the application again now, you will find no issues match the criteria because we just updated the issues.

## Conclusion

In the course of this discussion, you must have noticed that there are several query and mutation operations available in the GitHub API. You can use the API to extend the policy we created or create new policies for your projects.

I hope that you enjoyed this short tutorial. Please post in the comments below what you will build with the GitHub GraphQL APIs.

{{< subscribe >}}
