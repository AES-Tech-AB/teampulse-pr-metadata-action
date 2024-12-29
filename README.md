# TeamPulse PR Metadata Action

A GitHub Action that collects merged PR metadata and sends it to the [TeamPulse](https://teampulse.dev) API.

## Usage

1. Configure a workflow in your repository:

    ```yaml
    name: "Send PR Metadata to TeamPulse"

    on:
      pull_request:
        branches: [ "main" ]
        types: [ "closed" ]

    jobs:
      pr-metadata-to-teampulse:
        runs-on: ubuntu-latest
        if: ${{ github.event.pull_request.merged }}
        permissions:
          pull-requests: read # Required to fetch pull request details

        steps:
          - name: "Send merged PR metadata to TeamPulse"
            uses: aes-tech-ab/teampulse-pr-metadata-action@v1.0.0
            with:
              github_token: ${{ secrets.GITHUB_TOKEN }} # GitHub token for accessing API
              teampulse_token: ${{ secrets.TEAMPULSE_TOKEN }} # Authentication token for TeamPulse API
    ```

2. **Secrets**:
    - `GITHUB_TOKEN` is automatically provided by GitHub Actions.
    - `TEAMPULSE_TOKEN` must be created under your repository **Settings** -> **Secrets** -> **Actions**.

## Inputs

| Name           | Required | Description                                     |
|----------------|----------|-------------------------------------------------|
| `github_token` | Yes      | GitHub token to access PR data                  |
| `teampulse_token` | Yes   | Bearer token to authenticate with TeamPulse API |

## Outputs

| Name        | Description                          |
|-------------|--------------------------------------|
| `http_status` | The final HTTP status after sending. |


## License

[MIT](LICENSE)

---
<details>
  <summary><small>Advanced: Define Your Own Workflow</small></summary>
  <p><small>
  For organizations or users who prefer full control over data submission, here's an alternative workflow that defines all steps explicitly:
  </small></p>

  ```yaml
  name: "Send PR Metadata to TeamPulse"

  on:
    pull_request:
      branches:
        - main
      types: [closed]

  jobs:
     pr-metadata-to-teampulse:
      runs-on: ubuntu-latest
      if: ${{ github.event.pull_request.merged }}
      permissions:
        pull-requests: read

      steps:
        - name: Gather PR Metadata
          id: gather_pr_data
          uses: actions/github-script@v6
          env:
            GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          with:
            script: |
              const pr = context.payload.pull_request;

              if (!pr) {
                throw new Error("No pull_request context available.");
              }

              const { owner, repo } = context.repo;
              const prNumber = pr.number;

              const { data: prDetails } = await github.rest.pulls.get({
                owner,
                repo,
                pull_number: prNumber
              });

              const pullRequestDetails = {
                id: prDetails.id,
                number: prDetails.number,
                title: prDetails.title,
                created_at: prDetails.created_at,
                merged_at: prDetails.merged_at,
                additions: prDetails.additions,
                deletions: prDetails.deletions,
                changed_files: prDetails.changed_files,
                comments: prDetails.comments,
                review_comments: prDetails.review_comments,
                user: {
                  id: prDetails.user.id,
                  login: prDetails.user.login,
                  avatar_url: prDetails.user.avatar_url,
                  type: prDetails.user.type
                }
              };

              const issueComments = await github.paginate(
                github.rest.issues.listComments,
                { owner, repo, issue_number: prNumber }
              );

              const comments = issueComments.map(ic => ({
                id: ic.id,
                user: {
                  id: ic.user?.id,
                  login: ic.user?.login,
                  avatar_url: ic.user?.avatar_url,
                  type: ic.user?.type
                },
                created_at: ic.created_at
              }));

              const prReviews = await github.paginate(
                github.rest.pulls.listReviews,
                { owner, repo, pull_number: prNumber }
              );

              const reviews = prReviews.map(r => ({
                id: r.id,
                state: r.state,
                user: {
                  id: r.user?.id,
                  login: r.user?.login,
                  avatar_url: r.user?.avatar_url,
                  type: r.user?.type
                },
                submitted_at: r.submitted_at,
                comments: r.comments
              }));

              const reviewCommentsData = await github.paginate(
                github.rest.pulls.listReviewComments,
                { owner, repo, pull_number: prNumber }
              );

              const reviewComments = reviewCommentsData.map(rc => ({
                id: rc.id,
                user: {
                  id: rc.user?.id,
                  login: rc.user?.login,
                  avatar_url: rc.user?.avatar_url,
                  type: rc.user?.type
                },
                created_at: rc.created_at
              }));

              const timelineEvents = await github.paginate(
                github.rest.issues.listEventsForTimeline,
                {
                  owner,
                  repo,
                  issue_number: prNumber
                }
              );

              const timeline = timelineEvents.map(te => ({
                event: te.event,
                created_at: te.created_at
              }));

              const pullRequestFullData = {
                pull_request: pullRequestDetails,
                comments: comments,
                reviews: reviews,
                review_comments: reviewComments,
                timeline: timeline
              };

              const repository = {
                owner: context.repo.owner,
                name: context.repo.repo
              };

              const finalPayload = {
                repository,
                data: pullRequestFullData
              };

              core.setOutput('prJson', JSON.stringify(finalPayload));

        - name: Send Metadata to TeamPulse
          id: send_metadata
          env:
            API_ENDPOINT: https://teampulse.dev/api/v1/prs/data
            API_AUTH_TOKEN: ${{ secrets.TEAMPULSE_TOKEN }}
          run: |
            PR_JSON='${{ steps.gather_pr_data.outputs.prJson }}'
            MAX_RETRIES=5
            RETRY_DELAY=5

            echo "Submitting PR metadata to external API..."

            for attempt in $(seq 1 $MAX_RETRIES); do
              response=$(curl -s -o response.txt -w "%{http_code}" -X POST \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $API_AUTH_TOKEN" \
                -d "$PR_JSON" \
                "$API_ENDPOINT")

              if [ "$response" -ge 200 ] && [ "$response" -lt 300 ]; then
                echo "Metadata successfully submitted on attempt $attempt."
                exit 0
              else
                echo "Attempt $attempt failed with status code $response."
                if [ "$attempt" -lt "$MAX_RETRIES" ]; then
                  echo "Retrying in $RETRY_DELAY seconds..."
                  sleep $RETRY_DELAY
                  RETRY_DELAY=$(( RETRY_DELAY * 2 ))
                else
                  echo "All $MAX_RETRIES attempts failed. Exiting with error."
                  cat response.txt
                  exit 1
                fi
              fi
            done
  ```
</details>