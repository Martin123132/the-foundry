# Changelog

All notable user-facing changes to The Foundry are recorded here.

The Foundry is source-available for personal and non-commercial use under the
PolyForm Noncommercial License 1.0.0. Commercial use requires a separate written
license from TWO HANDS NETWORK LTD.

## Unreleased

- Added a first-run route picker for fresh installs with demo workspace and
  blank-form starting paths.
- Added a demo workspace seed flow that creates a published feedback form with
  local sample responses through the normal app API.
- Added a full no-form first-run workspace for empty installs, including
  templates, demo, and blank-form routes.
- Updated visible product copy to use the current source-available positioning.
- Isolated rendered accessibility test data per run to keep local and CI checks
  repeatable.
- Added first-tester smoke coverage for demo setup, blank-form launch,
  response export, definition import/export, public submission, and response
  cleanup.
- Added a first-tester checklist and README testing notes for release-readiness
  handoff.
- No new Docker image has been published for these unreleased changes.

## v0.1.0 - 2026-06-24

- Published the first public GHCR image:
  `ghcr.io/martin123132/the-foundry:v0.1.0`.
- Published the immutable commit SHA image tag:
  `ghcr.io/martin123132/the-foundry:cbaab6b4f130d3d13e4ae57c7772d272e95d5078`.
- Kept `latest` unpublished pending an explicit release policy decision.
- Added guarded Docker publishing governance, dry-run validation, policy checks,
  and build/run CI smoke coverage.
- Added starter templates for common form use cases.
- Added response search, filtering, CSV export, JSON export, and safe bulk
  response cleanup.
- Added stronger public sharing controls for published links and embeds.
- Added admin operations settings for storage, environment, and default form
  configuration.
- Added portable form definition import and export without responses or webhook
  URLs.
- Improved keyboard-friendly question reordering, drag handles, focus states,
  labels, and accessibility status messaging.
- Added rendered Playwright and axe accessibility smoke coverage.
- Added guided launch, sharing, response-review, and first-run demo workflows.
- Aligned README, package metadata, notice files, and license docs with the
  PolyForm Noncommercial source-available licensing posture.
