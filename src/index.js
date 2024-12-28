const core = require('@actions/core');
const github = require('@actions/github');
const axios = require('axios');

async function run() {
    try {
        // 1. Read action inputs
        const githubToken = core.getInput('github_token', { required: true });
        const apiEndpoint = core.getInput('api_endpoint', { required: true });
        const apiAuthToken = core.getInput('teampulse_token', { required: true });

        // 2. Validate that we're in a PR context
        const { context } = github;
        if (!context.payload.pull_request) {
            core.setFailed("This action must be run in the context of a Pull Request event.");
            return;
        }
        const pr = context.payload.pull_request;
        if (!pr.merged) {
            core.info("PR is not merged. Skipping action.");
            return;
        }

        // 3. Initialize Octokit
        const octokit = github.getOctokit(githubToken);
        const { owner, repo } = context.repo;
        const prNumber = pr.number;

        // 4. Fetch PR details
        const { data: prDetails } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber
        });

        // Basic metadata
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

        // Comments
        const issueComments = await octokit.paginate(octokit.rest.issues.listComments, {
            owner,
            repo,
            issue_number: prNumber
        });
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

        // Reviews
        const prReviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
            owner,
            repo,
            pull_number: prNumber
        });
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

        // Review comments
        const reviewCommentsData = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
            owner,
            repo,
            pull_number: prNumber
        });
        const review_comments = reviewCommentsData.map(rc => ({
            id: rc.id,
            user: {
                id: rc.user?.id,
                login: rc.user?.login,
                avatar_url: rc.user?.avatar_url,
                type: rc.user?.type
            },
            created_at: rc.created_at
        }));

        // Timeline
        const timelineData = await octokit.paginate(octokit.rest.issues.listEventsForTimeline, {
            owner,
            repo,
            issue_number: prNumber
        });
        const timeline = timelineData.map(te => ({
            event: te.event,
            created_at: te.created_at
        }));

        // Final payload
        const payload = {
            repository: {
                owner: owner,
                name: repo
            },
            data: {
                pull_request: pullRequestDetails,
                comments,
                reviews,
                review_comments,
                timeline
            }
        };

        // 5. Submit with retries
        let maxRetries = 5;
        let delayMs = 5000;
        let finalStatus = 0;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                core.info(`Attempt ${attempt} to send data`);
                const res = await axios.post(apiEndpoint, payload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiAuthToken}`
                    }
                });
                finalStatus = res.status;
                core.info(`Successfully sent PR data. HTTP status: ${finalStatus}`);
                break;
            } catch (error) {
                // If it's a network or 5xx error, we can retry
                const status = error.response?.status || 0;
                core.warning(`Attempt ${attempt} failed with status ${status}. Error: ${error.message}`);
                finalStatus = status;
                if (attempt < maxRetries) {
                    core.info(`Retrying in ${delayMs}ms...`);
                    await new Promise(r => setTimeout(r, delayMs));
                    delayMs *= 2; // Exponential backoff
                } else {
                    core.error(`All ${maxRetries} attempts failed.`);
                    core.setFailed(error.message);
                }
            }
        }

        // 6. Set action output
        core.setOutput('http_status', finalStatus);

    } catch (err) {
        core.setFailed(`Action failed: ${err.message}`);
    }
}

run();
