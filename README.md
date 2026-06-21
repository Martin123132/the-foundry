# The Foundry

The Foundry is a self-hosted forms and response workflow studio aimed at the
subscription-fatigue gap: build forms, publish public links, collect responses,
export CSV, and keep the data on your machine.

## Current MVP

- Form builder with common question types
- Guided launch path with next-best action
- Public `/f/:id` form runner
- One-question runner with clickable question map
- Draft/published state
- Response table
- CSV export
- Public link and iframe embed snippet
- Webhook delivery setting
- SQLite database stored under `.data/openforms.sqlite`
- AGPL-3.0-or-later license

## Run

Build the frontend and run the local server:

```powershell
$env:OPENFORMS_DATA_DIR = "D:\revenge-tour\openforms\.data"
npm run build
npm run start
```

The app serves on `http://127.0.0.1:4174` by default.

## Data

By default, the server stores data in:

```text
D:\revenge-tour\openforms\.data\openforms.sqlite
```

Set `OPENFORMS_DATA_DIR` to point at another directory. The legacy environment
variable and SQLite filename are retained for compatibility.
