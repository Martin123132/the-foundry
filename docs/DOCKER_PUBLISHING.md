# Docker Publishing Policy

The Foundry can build and smoke-run a production Docker image, but image
publishing is intentionally gated until the project owner confirms the registry
and release policy.

## Current State

- CI builds the image on every push and pull request.
- CI smoke-runs the image with a persistent `/data` volume.
- No workflow currently pushes an image to any registry.
- A manual dry-run workflow can build the intended GHCR tags without publishing.

## Proposed Registry

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

## Owner Decision Gate (Required for Closure)

Issue #9 should move from "in progress" to "blocked/waiting on approval" until
these fields are explicitly confirmed by the project owner:

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

When all fields are complete, add the publishing workflow, gate it to the approved
trigger only, and close issue #9.

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

## Enabling Publishing Later

When the registry and release policy are confirmed, use the guarded
**Docker Publish Release** workflow:

- Keep trigger as `workflow_dispatch` only.
- Keep `DOCKER_PUBLISH_ENABLED=true` repo variable as the hard gate.
- Keep `publish` input set to `true` only for approved release events.
- Keep the approved tag policy (`<version>`, `<sha>`, and optional `latest`) as the source of truth.
- Keep `Docker Publish Dry Run` available for final smoke verification.

Do not publish from ordinary branch pushes or pull requests.
