# Docker Publishing Readiness Checklist

Use this checklist as the decision gate for closing issue `#9` and enabling the
first real image publish.

## Registry & Access

- [ ] Registry confirmed: `ghcr.io/martin123132/the-foundry`
- [ ] GHCR package permissions verified for GitHub Actions (write)
- [ ] Owner approval recorded: _____________

## Trigger & Tag Policy

- [ ] Publish trigger approved:
  - [ ] Release tags only
  - [ ] GitHub Release publish event
  - [ ] Manual approval workflow (`workflow_dispatch`)
- [ ] Version tag format agreed (for example `v1.2.3`)
- [ ] Commit SHA tag required for traceability
- [ ] `latest` policy approved (`yes`/`no`)
- [ ] Rollback policy approved (delete/repush strategy documented)

## Workflow Safety Controls

- [ ] Real publish workflow remains separate from push/PR workflows
- [ ] Publish action can only run from approved trigger
- [ ] No public registry writes on ordinary `push` or `pull_request` runs
- [ ] Manual dry-run workflow remains available and unchanged

## Pre-Publish Evidence

- [ ] Dry run workflow executed successfully
- [ ] Container smoke test (`/api/meta`) passes
- [ ] Release notes/changelog updated for publishing event
- [ ] README + deployment docs updated with official pull command examples

## Sign-off

- [ ] Policy verifier (`npm run verify:docker-policy`) passes
- [ ] Project owner sign-off: _____________
- [ ] Date of approval: __ / __ / __

