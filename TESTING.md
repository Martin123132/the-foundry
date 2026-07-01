# First-Tester Checklist

Use this checklist when trying The Foundry from a fresh checkout or before a
tester-facing release cut.

## Ground Rules

- Use disposable test data only.
- Do not enter real customer responses, private webhook URLs, credentials, or
  production contact lists.
- Form definition exports are safe to share for demos because they omit
  responses and webhook URLs.
- Public runner mood is part of a form definition and should survive export and
  import.
- Response CSV and JSON exports can contain submitted answers, so treat them as
  local test artifacts.
- Docker image publishing, GitHub Releases, and tags are separate release
  decisions. This checklist does not require them.

## Local Setup

```powershell
npm install
npm run build
$env:OPENFORMS_DATA_DIR = ".data\tester-run"
npm run start
```

Open:

```text
http://127.0.0.1:4174
```

For a clean retest, stop the server and remove the disposable
`.data\tester-run` directory.

## First Five Minutes

1. Open the demo workspace.
2. Confirm it creates a published `Launch feedback demo` form with three local
   sample responses.
3. Search the responses, then export the visible set as CSV and JSON.
4. Change the public mood in the Presentation panel.
5. Export the form definition and confirm the copy says responses and webhook
   URLs are omitted.
6. Import the definition as a draft and confirm it has zero responses and keeps
   the selected public mood.
7. Create a blank form, change the title and description, save it, and publish
   it.
8. Open the live public runner, submit one test response, and return to the
   studio.
9. Select the test response, delete it, and confirm the response count returns
   to zero.
10. Check the Operations panel and confirm the data directory points at your
   disposable test directory.

## Visual QA

Check the app at desktop and narrow mobile widths:

- First-run route picker
- Builder with guidance panel, templates, response table, and inspector
- Sharing panel with draft/live/compact preview controls
- Presentation panel with theme presets and public mood choices
- Public runner in flow mode across at least one non-default public mood
- Empty, filtered, and deleted response states

Look for clipped labels, overlapping controls, unreadable contrast, scroll
traps, disabled controls that look active, or copy that leaves the next action
unclear.

## Automated Checks

Run the checks used by CI:

```powershell
npm run lint
npm run build
npm run test:smoke
npm run test:a11y
npm run verify:docker-policy
```

`npm run test:smoke` starts its own local servers and writes small ignored
artifacts under `.qa`. It covers demo setup, blank-form launch, public
submission, response export, definition import/export, malformed import
rejection, public mood preservation, and response cleanup.

## Release-Readiness Notes

Before cutting a tester-facing version:

- CI should be green on `main`.
- `CHANGELOG.md` should describe the tester-facing changes.
- `DOCKER_PUBLISH_ENABLED` should remain `false` unless an approved image
  publish is intentionally being run.
- No `latest` Docker tag should be introduced without an explicit release
  policy decision.
