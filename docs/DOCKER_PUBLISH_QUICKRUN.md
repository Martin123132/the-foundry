# Docker Publish Quick Run

Use this for the approval-to-publish path.

```bash
# 1) non-publishing dry run
gh workflow run docker-publish-dry-run.yml \
  --ref main \
  -f image_tag=v0.1.0 \
  -f include_latest=false
```

```bash
# 2) release workflow validation (no push)
gh workflow run docker-publish-release.yml \
  --ref main \
  -f image_tag=v0.1.0 \
  -f include_latest=false \
  -f publish=false
```

```bash
# 3) final release publish (owner-approved)
gh workflow run docker-publish-release.yml \
  --ref main \
  -f image_tag=v0.1.0 \
  -f include_latest=false \
  -f publish=true
```

```bash
# Optional: publish latest on first stable release only
gh workflow run docker-publish-release.yml \
  --ref main \
  -f image_tag=v0.1.0 \
  -f include_latest=true \
  -f publish=true
```

Remember:

- publish steps are blocked until `DOCKER_PUBLISH_ENABLED=true` exists as a repo variable.
- publishing workflow stays manual-only and off by default.
