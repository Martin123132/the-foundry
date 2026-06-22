# The Foundry

The Foundry is an open-source, self-hosted forms and response workflow studio.
It is built for people who want Typeform-style polish without response caps,
vendor lock-in, or handing their data to another subscription service.

![The Foundry builder](docs/images/the-foundry-builder.png)

## What It Does

- Build forms with short text, long text, email, number, choice, rating, and date fields
- Start from common templates for contact, events, feedback, bugs, leads, and internal requests
- Reorder questions with keyboard-friendly controls and drag handles
- Publish controlled public form links and iframe embeds
- Guide users through draft, launch, sharing, and response review
- Collect responses into local SQLite storage
- Search and filter collected responses
- Export responses as CSV or structured JSON
- Import and export full form definitions between installs
- Configure webhook delivery for downstream workflows
- Inspect storage, environment, and default form settings in the admin UI
- Run locally, on a small server, or in Docker

## Screenshots

![Starter template picker](docs/images/the-foundry-templates.png)

![Sharing controls](docs/images/the-foundry-sharing.png)

![Published form runner](docs/images/the-foundry-runner.png)

## Quick Start

Install dependencies, build the frontend, and run the server:

```powershell
npm install
npm run build
npm run start
```

The app runs at:

```text
http://127.0.0.1:4174
```

For local development with Vite:

```powershell
npm run dev
```

## Data Storage

By default, The Foundry stores data in:

```text
.data/openforms.sqlite
```

Set `OPENFORMS_DATA_DIR` to use another directory:

```powershell
$env:OPENFORMS_DATA_DIR = "D:\foundry-data"
npm run serve
```

The legacy `OPENFORMS_DATA_DIR` name and `openforms.sqlite` filename are kept
for compatibility with existing local installs.

The admin Operations panel shows the active SQLite mode, data directory,
database file, bind address, port, and default new-form colors.

## Form Definitions

Use the Definition panel in the admin UI to export a form as portable JSON or
import a JSON definition as a new draft. Definition exports include form copy,
mode, colors, and questions. They intentionally omit responses and webhook URLs
so demo files can be shared without collected data or private delivery targets.

## Docker

Build and run with Docker Compose:

```powershell
docker compose up --build
```

The container serves the app on:

```text
http://127.0.0.1:4174
```

Docker stores SQLite data in the `foundry-data` volume mounted at `/data`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production notes, environment variables,
Docker hosting, reverse proxy guidance, and backup targets.

## Deployment Notes

The server is a small Node app that serves the built React frontend and owns the
SQLite database. For a production deployment:

- Run `npm run build` before `npm run start`
- Set `PORT` if your host assigns one
- Set `OPENFORMS_DATA_DIR` to a persistent disk
- Put the app behind HTTPS
- Back up the SQLite database regularly

## Scripts

```text
npm run dev      Start the Vite dev server
npm run build    Type-check and build the frontend
npm run lint     Run ESLint
npm run start    Start the production Node server
npm run serve    Build, then start the production server
```

## Roadmap

- Response search, filtering, and JSON export polish
- Stronger public sharing controls
- Docker image publishing
- Accessibility and keyboard QA passes

## License

The Foundry is licensed under AGPL-3.0-or-later. If you improve it for a hosted
service, share those improvements back with the people who made the commons
valuable in the first place.
