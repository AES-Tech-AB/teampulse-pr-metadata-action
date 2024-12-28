# TeamPulse PR Metadata Action

A GitHub Action that collects merged PR metadata and sends it to the TeamPulse API.

## Usage

1. Configure a workflow in your repository:

```yaml
name: "Send PR Metadata to TeamPulse"

on:
  pull_request:
    branches: [ "main" ]
    types: [ "closed" ]

jobs:
  post-merge:
    runs-on: ubuntu-latest
    if: ${{ github.event.pull_request.merged == true }}
    steps:
      - name: Post Merge Metadata
        uses: aes-tech-ab/teampulse-post-merge-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          teampulse_token: ${{ secrets.TEAMPULSE_TOKEN }}
```

2. **Secrets**:
    - `GITHUB_TOKEN` is automatically provided by GitHub Actions.
    - `TEAMPULSE_TOKEN` must be created under your repository Settings -> Secrets -> Actions.

## Inputs

| Name          | Required | Description                                     |
|---------------|---------|-------------------------------------------------|
| github_token  | Yes     | GitHub token to access PR data                  |
| teampulse_token| Yes     | Bearer token to authenticate with TeamPulse API |

## Outputs

| Name         | Description                          |
|--------------|--------------------------------------|
| http_status  | The final HTTP status after sending. |

## License

[MIT](LICENSE)
