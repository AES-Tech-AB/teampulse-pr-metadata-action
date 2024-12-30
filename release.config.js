module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        [
            '@semantic-release/release-notes-generator',
            {
                preset: false,
                writerOpts: {
                    transform: (commit) => ({
                        subject: `${commit.subject}`,
                        shortHash: `${commit.hash.substring(0, 7)}`
                    }),
                    groupBy: null,
                },
            },
        ],
        [
            '@semantic-release/exec',
            {
                // Command to update the version in README.md
                prepareCmd: 'sed -i "s/pr-metadata-action@v[0-9]\\+\\.[0-9]\\+\\.[0-9]\\+/pr-metadata-action@v${nextRelease.version}/g" README.md',
            }
        ],
        '@semantic-release/github',
        [
            '@semantic-release/git',
            {
                assets: ['dist/index.js', 'README.md', 'package.json', 'package-lock.json'],
                message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
            }
        ]
    ],
};