# Deployment

The Foundry runs as one Node server that serves the built React app and writes
SQLite data to a local directory.

## Requirements

- Node 24 or newer
- A persistent writable directory for SQLite
- HTTPS at the edge, provided by your host or reverse proxy

## Environment

```text
PORT=4174
HOST=127.0.0.1
OPENFORMS_DATA_DIR=/data
```

`OPENFORMS_DATA_DIR` must point at persistent storage. If it points at an
ephemeral filesystem, form definitions and responses may disappear when the
service restarts.

The admin Operations panel reflects the active `HOST`, `PORT`,
`OPENFORMS_DATA_DIR`, SQLite database file, and built-in new-form defaults.

Form definition exports are safe to move between installs. They contain form
copy, colors, mode, and questions, but omit collected responses and webhook
URLs. Imported definitions always start as drafts.

## Generic Host

```bash
npm ci
npm run build
OPENFORMS_DATA_DIR=/data PORT=4174 npm run start
```

## Docker Host

```bash
docker compose up --build -d
```

For a direct Docker run:

```bash
docker build -t the-foundry:local .
docker run -d --name the-foundry \
  -p 4174:4174 \
  -v foundry-data:/data \
  the-foundry:local
```

Back up the Docker volume named `openforms_foundry-data` or the host path you
mount at `/data`.

The production image runs as the non-root `node` user, stores SQLite files in
`/data`, and exposes a healthcheck against `/api/meta`. The public GHCR image
uses predictable tags such as `ghcr.io/martin123132/the-foundry:<version>` and
`ghcr.io/martin123132/the-foundry:<commit-sha>`.

The first published image is:

```bash
docker pull ghcr.io/martin123132/the-foundry:v0.1.0
docker run -d --name the-foundry \
  -p 4174:4174 \
  -v foundry-data:/data \
  ghcr.io/martin123132/the-foundry:v0.1.0
```

No `latest` tag is published yet. Future publishing remains gated by the manual
release workflow and repository variable `DOCKER_PUBLISH_ENABLED=true`.

See [docs/DOCKER_PUBLISHING.md](docs/DOCKER_PUBLISHING.md) before enabling any
registry push workflow.

## Reverse Proxy

The app listens on `127.0.0.1` by default in the Node server. Containers should
set `HOST=0.0.0.0` so Docker port publishing can reach the process. Set `PORT`
as required and place the app behind the host's normal HTTP routing layer.

## Backups

Back up these files from `OPENFORMS_DATA_DIR`:

```text
openforms.sqlite
openforms.sqlite-shm
openforms.sqlite-wal
webhook-errors.log
```

The `webhook-errors.log` file only exists after webhook delivery failures.
