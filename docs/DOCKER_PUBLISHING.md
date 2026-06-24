# Docker Publishing Policy

The Foundry builds, smoke-runs, and publishes production Docker images through a
manual, gated GHCR release workflow.

## Current State

- CI builds the image on every push and pull request.
- CI smoke-runs the image with a persistent `/data` volume.
- A manual dry-run workflow can build the intended GHCR tags without publishing.
- A manual release workflow can publish only when `publish=true` and repository
  variable `DOCKER_PUBLISH_ENABLED=true` are both present.
- The first public image was published as `v0.1.0` with an immutable commit SHA
  tag. No `latest` tag is published yet.

## Registry

Use GitHub Container Registry:

```text
ghcr.io/martin123132/the-foundry
```

## Tag Policy

Use predictable, immutable tags:

```text
ghcr.io/martin123132/the-foundry:<version>
ghcr.io/martin123132/the-foundry:<commit-sha>
```

Only add `latest` for explicit stable releases after the release policy is
confirmed.

First published tags:

```text
ghcr.io/martin123132/the-foundry:v0.1.0
ghcr.io/martin123132/the-foundry:cbaab6b4f130d3d13e4ae57c7772d272e95d5078
```

## Publish Checklist

Before enabling a real publishing workflow:

- Confirm GHCR is the official registry.
- Confirm the repository has package write permissions for GitHub Actions.
- Decide whether publishing happens from release tags, GitHub Releases, or a
  manual approval workflow.
- Decide whether `latest` should be published, and from which release source.
- Confirm the image remains AGPL-3.0-or-later and public.
- Confirm no private URLs, secrets, datasets, or local paths are copied into the
  Docker context.
- Run the non-publishing dry run and verify the built image smoke test passes.

## Owner Decision Gate

Before any future publish policy change, confirm these fields with the project
owner:

- Registry: `ghcr.io` confirmed (yes/no)
- Package write permission granted to GitHub Actions for this repository (yes/no)
- Publish trigger approved (`release` tag, `workflow_dispatch`, or release workflow)
- Allowed tags for first publish (`<version>` and `<sha>`; decide on `latest` policy)
- Required manual checks before first publish:
  - dry-run workflow result
  - changelog/release notes update
  - at least one release-tag smoke test

Use this as the release-safe payload template:

```text
Registry: ghcr.io/martin123132/the-foundry
Release trigger: ______________
Tag policy:
- <version>: ______________
- <sha>: ______________
- latest: (yes/no)
Owner approval date: ______________
```

When all fields are complete, use the existing guarded release workflow and keep
the approved trigger/tag policy documented here.

## Concrete Readiness Checklist

See the full, fillable checklist in:

- [docs/DOCKER_PUBLISHING_CHECKLIST.md](DOCKER_PUBLISHING_CHECKLIST.md)

## Dry Run

Run the manual **Docker Publish Dry Run** workflow from GitHub Actions. It:

- Builds the image with the intended GHCR tag names.
- Smoke-runs the image with a Docker volume mounted at `/data`.
- Verifies `/api/meta` from inside the container.
- Does not authenticate to GHCR.
- Does not call `docker push`.

CI also runs `npm run verify:docker-policy` to check that the dry-run workflow
stays manual, read-only for packages, and free of registry login or push steps.

## Publishing Future Releases

For future releases, use the guarded **Docker Publish Release** workflow:

- Keep trigger as `workflow_dispatch` only.
- Keep `DOCKER_PUBLISH_ENABLED=true` repo variable as the hard gate.
- Keep `publish` input set to `true` only for approved release events.
- Keep the approved tag policy (`<version>`, `<sha>`, and optional `latest`) as the source of truth.
- Keep `Docker Publish Dry Run` available for final smoke verification.

Do not publish from ordinary branch pushes or pull requests.

## Controlled Release Runbook

When ready to do an approved release publish:

> This workflow is intentionally blocked unless `DOCKER_PUBLISH_ENABLED=true` is
> set in repository variables and `publish=true` is selected in the manual run.

1. Confirm open-source policy/docs:

- `docs/DOCKER_PUBLISHING_CHECKLIST.md`
- `docs/DOCKER_PUBLISHING.md`
- issue `#9` decision notes

2. Run a final dry-run against the intended tag:

```bash
gh workflow run docker-publish-dry-run.yml \
  --ref main \
  -f image_tag=vX.Y.Z \
  -f include_latest=false
```

3. Confirm policy checks in the repo:

- set repository variable `DOCKER_PUBLISH_ENABLED=true`
- if needed, define exact release tag and `latest` policy

4. Run the release workflow with explicit publish intent:

```bash
gh workflow run docker-publish-release.yml \
  --ref main \
  -f image_tag=vX.Y.Z \
  -f include_latest=false \
  -f publish=false
```

This run validates the release-path build and smoke checks without writing to GHCR.

5. When approvals are finalized, run the same command with `publish=true` to push:

```bash
gh workflow run docker-publish-release.yml \
  --ref main \
  -f image_tag=vX.Y.Z \
  -f include_latest=false \
  -f publish=true
```

For a quick copy/paste block, see:

- [docs/DOCKER_PUBLISH_QUICKRUN.md](DOCKER_PUBLISH_QUICKRUN.md)

For explicit owner sign-off, use the [Docker publish approval issue form](https://github.com/Martin123132/the-foundry/issues/new?template=docker_publish_approval.yml)
before running the final `publish=true` workflow.
