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

When the registry and release policy are confirmed, add a separate publish step
that logs in to GHCR with `GITHUB_TOKEN` and pushes only from the approved
release trigger. Do not publish from ordinary branch pushes or pull requests.
