# Server Fetcher

The server fetcher is a crucial part of our application. It is responsible for fetching data from various providers and processing it for further use. This document provides a high-level overview of its functionality and endpoints.

For now, the server fetcher uses the matcher. The matcher is a script that matches the fetched locations with their corresponding Google Place IDs. This is a crucial step as many times Google does not return the correct place ID or it returns multiple. We have developed a matching algorithm to find the correct place ID given the name, address, and coordinates.

For now this is an ongoing project, we are working on adding more providers and improving the matching algorithm.

## Endpoints

[`/api/fetcher/{provider}`](./providers`)

This is a list of endpoints from the specified provider. The data fetched includes various details about locations. We just map those details to the ones we need and defined as `BasicLocation` at [`/api/fetcher/lib/types.ts`](./lib/types.ts).

[`/api/fetcher/match-placeid.post.ts`](./match-placeid.post.ts)

This endpoint is responsible for matching the fetched locations with their corresponding Google Place IDs.

1. First we fetch matches using "Match By Address Search" or "Match By Coordinates Search" explained below. The code of the script is located at [`/api/fetcher/lib/matcher.ts`](./lib/matcher.ts).
2. For every location we get a list of matches.
3. We then score each classify using the [`score.ts`](./lib/score.ts) script.
   - The score is made up of 3 parameters: `name`, `address`(if we have it), and `coordinates`. Each parameter is scored individually and then the total score is calculated with an average of the 3 parameters.
     - `name` and `address` are scored using the [Levenshtein distance](https://en.wikipedia.org/wiki/Levenshtein_distance) algorithm and the [Jaro-Winkler distance](https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance) algorithm. This distances are not the best for this use case and further research is needed to find a better algorithm.
     - `coordinates` are scored using the [Haversine formula](https://en.wikipedia.org/wiki/Haversine_formula). Then, we normalize the score to a value between 0 and 1 being 1 the best score and 0 the worst (starting from 50 km).
   - Finally, we classify each of the matches as:
     - `Success`: There is only one match for the location and there is only one location with a score higher than the threshold (currently at 0.8).
     - `NoMatch`: Google did not return any matches for the location.
     - `MultipleMatches`: There is more than one match for the location and there are none or more than 1 with a score higher than the threshold.
     - `Inconclusive`: Any of the matches has a score higher than the threshold but there is more than one match for the location.
4. We then upload the locations to the database using the [`database.ts`](./lib/database.ts) script.
   - Locations with a "Success" state are uploaded to the database and a CSV called "ok+{timestamp}.csv" is uploaded to a bucket in Supabase inside a folder with the name of the provider.
   - Locations with a non "Success" state are uploaded to a CSV called "conflicts+{timestamp}.csv" is uploaded to a bucket in Supabase inside a folder with the name of the provider.

### Match By Address Search

If the location has an address, we use the address to search for the corresponding Google Place ID. This is the preferred method as it is the most accurate, but we can't always rely on it as many times the address is not provided.

### Match By Coordinates Search

If the location does not have an address, we use the coordinates to search for the corresponding Google Place ID. Much less accurate than the previous method, but it is the only option we have in some cases.
