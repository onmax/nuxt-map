# Server Fetcher

The server fetcher is a crucial part of our application. It is responsible for fetching data from various providers and processing it for further use. This document provides a high-level overview of its functionality and endpoints.

For now, the server fetcher uses the matcher. The matcher is a script that matches the fetched locations with their corresponding Google Place IDs. This is a crucial step as many times Google does not return the correct place ID or it returns multiple. We have developed a matching algorithm to find the correct place ID given the name, address, and coordinates.

For now this is an ongoing project, we are working on adding more providers and improving the matching algorithm.

## Endpoints

[`/api/fetcher/{provider}`](./providers`)

This is a list of endpoints from the specified provider. The data fetched includes various details about locations. We just map those details to the ones we need and defined as `BasicLocation` at [`/api/fetcher/lib/types.ts`](./lib/types.ts).

[`/api/fetcher/match-placeid.post.ts`](./match-placeid.post.ts)

This endpoint is responsible for matching the fetched locations with their corresponding Google Place IDs.
