import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const distDir = join(rootDir, 'dist')
const dataDir = process.env.OPENFORMS_DATA_DIR || join(rootDir, '.data')
const dbPath = join(dataDir, 'openforms.sqlite')
const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT || 4174)
const rateWindowMs = 60_000
const rateLimit = new Map()
const defaultSuccessMessage = 'Thanks, your response was recorded.'
const defaultClosedMessage = 'This form is not accepting responses right now.'
const validFieldTypes = new Set([
  'short_text',
  'long_text',
  'email',
  'number',
  'single_choice',
  'multi_choice',
  'dropdown',
  'rating',
  'date',
])

mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(dbPath)
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL,
    mode TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    background_color TEXT NOT NULL,
    text_color TEXT NOT NULL,
    success_message TEXT NOT NULL,
    closed_message TEXT NOT NULL DEFAULT 'This form is not accepting responses right now.',
    webhook_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fields (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    placeholder TEXT NOT NULL,
    required INTEGER NOT NULL,
    options_json TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS responses (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    answers_json TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

ensureFormSchema()
seedDatabase()

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`)

    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url)
      return
    }

    serveStatic(response, url.pathname)
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message })
      return
    }
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Internal server error',
    })
  }
})

function ensureFormSchema() {
  const columns = new Set(
    db.prepare('PRAGMA table_info(forms)').all().map((column) => column.name),
  )

  if (!columns.has('closed_message')) {
    db.exec(
      `ALTER TABLE forms ADD COLUMN closed_message TEXT NOT NULL DEFAULT '${defaultClosedMessage}'`,
    )
  }
}

server.listen(port, host, () => {
  console.log(`The Foundry running at http://${host}:${port}`)
  console.log(`Data directory: ${dataDir}`)
})

async function handleApi(request, response, url) {
  const parts = url.pathname.split('/').filter(Boolean)

  if (request.method === 'GET' && url.pathname === '/api/forms') {
    sendJson(response, 200, listForms())
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/meta') {
    sendJson(response, 200, getMeta())
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/forms') {
    const form = createForm()
    sendJson(response, 201, form)
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/forms/import') {
    const body = await readJson(request)
    const form = importFormDefinition(body)
    sendJson(response, 201, form)
    return
  }

  if (parts[0] === 'api' && parts[1] === 'forms' && parts[2]) {
    const formId = parts[2]

    if (request.method === 'GET' && parts.length === 3) {
      const form = getForm(formId)
      if (!form) {
        sendJson(response, 404, { error: 'Form not found' })
        return
      }
      sendJson(response, 200, form)
      return
    }

    if (request.method === 'PUT' && parts.length === 3) {
      const body = await readJson(request)
      const form = saveForm(formId, body)
      sendJson(response, 200, form)
      return
    }

    if (parts[3] === 'responses' && request.method === 'GET') {
      sendJson(response, 200, listResponses(formId))
      return
    }

    if (parts[3] === 'responses' && request.method === 'DELETE') {
      const body = await readJson(request)
      sendJson(response, 200, deleteResponses(formId, body))
      return
    }

    if (parts[3] === 'responses' && request.method === 'POST') {
      const ip = request.socket.remoteAddress || 'unknown'
      if (!allowRequest(formId, ip)) {
        sendJson(response, 429, { error: 'Too many submissions. Try again soon.' })
        return
      }
      const body = await readJson(request)
      const result = await submitResponse(formId, body, ip)
      sendJson(response, 201, result)
      return
    }

    if (parts[3] === 'export.csv' && request.method === 'GET') {
      sendCsv(response, formId)
      return
    }

    if (parts[3] === 'definition.json' && request.method === 'GET') {
      sendFormDefinition(response, formId)
      return
    }
  }

  sendJson(response, 404, { error: 'Not found' })
}

function listForms() {
  const rows = db
    .prepare(
      `
      SELECT forms.*,
        (SELECT COUNT(*) FROM responses WHERE responses.form_id = forms.id) AS response_count
      FROM forms
      ORDER BY updated_at DESC
    `,
    )
    .all()

  return rows.map(rowToFormSummary)
}

function getForm(formId) {
  const row = db.prepare('SELECT * FROM forms WHERE id = ?').get(formId)
  if (!row) {
    return null
  }

  return {
    ...rowToFormSummary(row),
    fields: db
      .prepare('SELECT * FROM fields WHERE form_id = ? ORDER BY position ASC')
      .all(formId)
      .map(rowToField),
  }
}

function createForm() {
  const now = new Date().toISOString()
  const formId = randomUUID()
  db.prepare(
    `
    INSERT INTO forms (
      id, title, description, status, mode, accent_color, background_color,
      text_color, success_message, closed_message, webhook_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    formId,
    'Untitled form',
    'Collect structured responses without response caps.',
    'draft',
    'flow',
    '#087f7a',
    '#f7f8f8',
    '#1f2937',
    defaultSuccessMessage,
    defaultClosedMessage,
    '',
    now,
    now,
  )

  insertField(formId, {
    id: randomUUID(),
    type: 'short_text',
    label: 'What should we call you?',
    placeholder: 'Your name',
    required: true,
    options: [],
    position: 0,
  })

  return getForm(formId)
}

function importFormDefinition(body) {
  const definition = normalizeFormDefinition(body)
  const now = new Date().toISOString()
  const formId = randomUUID()

  db.prepare(
    `
    INSERT INTO forms (
      id, title, description, status, mode, accent_color, background_color,
      text_color, success_message, closed_message, webhook_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    formId,
    definition.title,
    definition.description,
    'draft',
    definition.mode,
    definition.accentColor,
    definition.backgroundColor,
    definition.textColor,
    definition.successMessage,
    definition.closedMessage,
    '',
    now,
    now,
  )

  definition.fields.forEach((field, position) => {
    insertField(formId, {
      id: randomUUID(),
      type: field.type,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options,
      position,
    })
  })

  return getForm(formId)
}

function getMeta() {
  return {
    storageMode: 'sqlite',
    dataDir,
    databaseFile: dbPath,
    environment: {
      host,
      port,
      dataDirVariable: 'OPENFORMS_DATA_DIR',
    },
    defaults: {
      newFormStatus: 'draft',
      mode: 'flow',
      accentColor: '#087f7a',
      backgroundColor: '#f7f8f8',
      textColor: '#1f2937',
    },
  }
}

function saveForm(formId, body) {
  const existing = getForm(formId)
  if (!existing) {
    throw new HttpError(404, 'Form not found')
  }

  const now = new Date().toISOString()
  const status = body.status === 'published' ? 'published' : 'draft'
  const mode = body.mode === 'classic' ? 'classic' : 'flow'
  const fields = Array.isArray(body.fields) ? body.fields : []

  db.prepare(
    `
    UPDATE forms SET
      title = ?,
      description = ?,
      status = ?,
      mode = ?,
      accent_color = ?,
      background_color = ?,
      text_color = ?,
      success_message = ?,
      closed_message = ?,
      webhook_url = ?,
      updated_at = ?
    WHERE id = ?
  `,
  ).run(
    cleanText(body.title, 'Untitled form'),
    cleanText(body.description, ''),
    status,
    mode,
    cleanColor(body.accentColor, '#087f7a'),
    cleanColor(body.backgroundColor, '#f7f8f8'),
    cleanColor(body.textColor, '#1f2937'),
    cleanText(body.successMessage, defaultSuccessMessage),
    cleanText(body.closedMessage, defaultClosedMessage),
    cleanText(body.webhookUrl, ''),
    now,
    formId,
  )

  db.prepare('DELETE FROM fields WHERE form_id = ?').run(formId)
  fields.forEach((field, index) => {
    insertField(formId, {
      id: cleanText(field.id, randomUUID()),
      type: validFieldType(field.type),
      label: cleanText(field.label, `Question ${index + 1}`),
      placeholder: cleanText(field.placeholder, ''),
      required: Boolean(field.required),
      options: Array.isArray(field.options)
        ? field.options.map((option) => cleanText(option, '')).filter(Boolean)
        : [],
      position: index,
    })
  })

  return getForm(formId)
}

async function submitResponse(formId, body, ip) {
  const form = getForm(formId)
  if (!form) {
    throw new HttpError(404, 'Form not found')
  }
  if (form.status !== 'published') {
    throw new HttpError(403, 'Form is not published')
  }
  if (body?.honeypot) {
    return { ok: true, responseId: randomUUID() }
  }

  const answers = sanitizeAnswers(form, body?.answers || {})
  const missing = form.fields.find((field) => {
    if (!field.required) {
      return false
    }
    const value = answers[field.id]
    return Array.isArray(value) ? value.length === 0 : String(value ?? '').trim() === ''
  })

  if (missing) {
    throw new HttpError(400, `Missing answer: ${missing.label}`)
  }

  const responseId = randomUUID()
  const now = new Date().toISOString()
  db.prepare(
    `
    INSERT INTO responses (id, form_id, answers_json, ip_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(responseId, formId, JSON.stringify(answers), hashIp(ip), now)

  if (form.webhookUrl) {
    void postWebhook(form.webhookUrl, { formId, responseId, answers, createdAt: now })
  }

  return { ok: true, responseId }
}

function listResponses(formId) {
  return db
    .prepare('SELECT * FROM responses WHERE form_id = ? ORDER BY created_at DESC')
    .all(formId)
    .map((row) => ({
      id: row.id,
      formId: row.form_id,
      answers: JSON.parse(row.answers_json),
      createdAt: row.created_at,
    }))
}

function deleteResponses(formId, body) {
  if (!getForm(formId)) {
    throw new HttpError(404, 'Form not found')
  }

  const responseIds = Array.isArray(body?.responseIds)
    ? [
        ...new Set(
          body.responseIds.filter(
            (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(id),
          ),
        ),
      ]
    : []

  if (responseIds.length === 0) {
    throw new HttpError(400, 'Select at least one response to delete')
  }

  if (responseIds.length > 500) {
    throw new HttpError(400, 'Delete at most 500 responses at a time')
  }

  const statement = db.prepare('DELETE FROM responses WHERE form_id = ? AND id = ?')
  let deleted = 0
  for (const responseId of responseIds) {
    deleted += statement.run(formId, responseId).changes
  }

  return { deleted }
}

function sendCsv(response, formId) {
  const form = getForm(formId)
  if (!form) {
    sendJson(response, 404, { error: 'Form not found' })
    return
  }

  const rows = listResponses(formId)
  const headers = ['submitted_at', ...form.fields.map((field) => field.label)]
  const lines = [
    headers.map(csvCell).join(','),
    ...rows.map((row) =>
      [
        row.createdAt,
        ...form.fields.map((field) => {
          const answer = row.answers[field.id]
          return Array.isArray(answer) ? answer.join('; ') : answer ?? ''
        }),
      ]
        .map(csvCell)
        .join(','),
    ),
  ]

  response.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${slugify(form.title)}-responses.csv"`,
  })
  response.end(lines.join('\n'))
}

function sendFormDefinition(response, formId) {
  const form = getForm(formId)
  if (!form) {
    sendJson(response, 404, { error: 'Form not found' })
    return
  }

  const payload = buildFormDefinition(form)
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="${slugify(form.title)}-definition.json"`,
  })
  response.end(`${JSON.stringify(payload, null, 2)}\n`)
}

function buildFormDefinition(form) {
  return {
    exportVersion: 1,
    source: 'the-foundry',
    exportedAt: new Date().toISOString(),
    omitted: {
      responses: true,
      webhookUrl: true,
    },
    form: {
      title: form.title,
      description: form.description,
      mode: form.mode,
      accentColor: form.accentColor,
      backgroundColor: form.backgroundColor,
      textColor: form.textColor,
      successMessage: form.successMessage,
      closedMessage: form.closedMessage,
      fields: form.fields.map((field, index) => ({
        type: field.type,
        label: field.label,
        placeholder: field.placeholder,
        required: field.required,
        options: Array.isArray(field.options) ? field.options : [],
        position: index,
      })),
    },
  }
}

function rowToFormSummary(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    mode: row.mode,
    accentColor: row.accent_color,
    backgroundColor: row.background_color,
    textColor: row.text_color,
    successMessage: row.success_message || defaultSuccessMessage,
    closedMessage: row.closed_message || defaultClosedMessage,
    webhookUrl: row.webhook_url,
    fields: [],
    responseCount: Number(row.response_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToField(row) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    placeholder: row.placeholder,
    required: Boolean(row.required),
    options: JSON.parse(row.options_json),
    position: row.position,
  }
}

function insertField(formId, field) {
  db.prepare(
    `
    INSERT INTO fields (
      id, form_id, type, label, placeholder, required, options_json, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    field.id,
    formId,
    validFieldType(field.type),
    field.label,
    field.placeholder,
    field.required ? 1 : 0,
    JSON.stringify(field.options || []),
    field.position,
  )
}

function sanitizeAnswers(form, answers) {
  const clean = {}
  for (const field of form.fields) {
    const value = answers[field.id]
    if (Array.isArray(value)) {
      clean[field.id] = value.map((item) => cleanText(item, '')).filter(Boolean)
    } else if (typeof value === 'number') {
      clean[field.id] = Number.isFinite(value) ? value : ''
    } else {
      clean[field.id] = cleanText(value, '')
    }
  }
  return clean
}

async function readJson(request) {
  const chunks = []
  for await (const chunk of request) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) {
    return {}
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Body must be valid JSON')
  }
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

function serveStatic(response, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname
  const normalized = normalize(decodeURIComponent(safePath)).replace(/^(\.\.[/\\])+/, '')
  let filePath = resolve(distDir, `.${normalized}`)

  if (!filePath.startsWith(resolve(distDir))) {
    sendJson(response, 403, { error: 'Forbidden' })
    return
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html')
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Build the app first with npm run build.')
    return
  }

  const ext = extname(filePath)
  response.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
  })
  response.end(readFileSync(filePath))
}

function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM forms').get().count
  if (count > 0) {
    return
  }

  const now = new Date().toISOString()
  const formId = randomUUID()
  db.prepare(
    `
    INSERT INTO forms (
      id, title, description, status, mode, accent_color, background_color,
      text_color, success_message, closed_message, webhook_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    formId,
    'Launch feedback',
    'A compact form for collecting product feedback after a beta launch.',
    'published',
    'flow',
    '#087f7a',
    '#ffffff',
    '#1f2937',
    'Thanks. Your feedback is in the vault.',
    defaultClosedMessage,
    '',
    now,
    now,
  )

  ;[
    {
      type: 'email',
      label: 'What email should we use for follow-up?',
      placeholder: 'you@example.com',
      required: true,
      options: [],
    },
    {
      type: 'single_choice',
      label: 'How would you rate the first impression?',
      placeholder: '',
      required: true,
      options: ['Strong', 'Promising', 'Needs work'],
    },
    {
      type: 'long_text',
      label: 'What should we improve next?',
      placeholder: 'Tell us where the product should go.',
      required: true,
      options: [],
    },
  ].forEach((field, position) => {
    insertField(formId, {
      id: randomUUID(),
      position,
      ...field,
    })
  })
}

function validFieldType(type) {
  return validFieldTypes.has(type) ? type : 'short_text'
}

function normalizeFormDefinition(body) {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'Import file must be a JSON object')
  }
  if (body.exportVersion !== 1 || body.source !== 'the-foundry') {
    throw new HttpError(400, 'Import file must be a The Foundry definition export')
  }
  if (!body.form || typeof body.form !== 'object') {
    throw new HttpError(400, 'Import file is missing a form definition')
  }

  const form = body.form
  if (!Array.isArray(form.fields)) {
    throw new HttpError(400, 'Import file must include a fields array')
  }
  if (form.fields.length === 0) {
    throw new HttpError(400, 'Import file must include at least one field')
  }
  if (form.fields.length > 100) {
    throw new HttpError(400, 'Import file cannot include more than 100 fields')
  }

  return {
    title: requiredImportText(form.title, 'title', 140),
    description: optionalImportText(form.description, 1000),
    mode: form.mode === 'classic' ? 'classic' : 'flow',
    accentColor: importColor(form.accentColor, 'accentColor', '#087f7a'),
    backgroundColor: importColor(form.backgroundColor, 'backgroundColor', '#f7f8f8'),
    textColor: importColor(form.textColor, 'textColor', '#1f2937'),
    successMessage: optionalImportText(
      form.successMessage,
      500,
      defaultSuccessMessage,
    ),
    closedMessage: optionalImportText(
      form.closedMessage,
      500,
      defaultClosedMessage,
    ),
    fields: form.fields.map((field, index) => normalizeImportField(field, index)),
  }
}

function normalizeImportField(field, index) {
  if (!field || typeof field !== 'object') {
    throw new HttpError(400, `Field ${index + 1} must be an object`)
  }
  if (!validFieldTypes.has(field.type)) {
    throw new HttpError(400, `Field ${index + 1} has an unsupported type`)
  }

  const needsOptions =
    field.type === 'single_choice' ||
    field.type === 'multi_choice' ||
    field.type === 'dropdown'
  const options = Array.isArray(field.options)
    ? field.options
        .map((option) => optionalImportText(option, 160))
        .filter(Boolean)
        .slice(0, 100)
    : []

  if (needsOptions && options.length === 0) {
    throw new HttpError(400, `Field ${index + 1} needs at least one option`)
  }

  return {
    type: field.type,
    label: requiredImportText(field.label, `field ${index + 1} label`, 240),
    placeholder: optionalImportText(field.placeholder, 500),
    required: Boolean(field.required),
    options: needsOptions ? options : [],
  }
}

function requiredImportText(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpError(400, `Import file is missing ${label}`)
  }

  return value.trim().slice(0, maxLength)
}

function optionalImportText(value, maxLength, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : fallback
}

function importColor(value, label, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new HttpError(400, `Import file has an invalid ${label}`)
  }
  return value
}

function cleanText(value, fallback) {
  return typeof value === 'string' ? value.slice(0, 5000) : fallback
}

function cleanColor(value, fallback) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function hashIp(ip) {
  return createHash('sha256').update(ip).digest('hex')
}

function allowRequest(formId, ip) {
  const key = `${formId}:${ip}`
  const now = Date.now()
  const entry = rateLimit.get(key)
  if (!entry || now - entry.startedAt > rateWindowMs) {
    rateLimit.set(key, { startedAt: now, count: 1 })
    return true
  }
  entry.count += 1
  return entry.count <= 12
}

async function postWebhook(url, payload) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    await writeFile(
      join(dataDir, 'webhook-errors.log'),
      `${new Date().toISOString()} ${error instanceof Error ? error.message : String(error)}\n`,
      { flag: 'a' },
    )
  }
}

function csvCell(value) {
  const text = String(value ?? '')
  return `"${text.replaceAll('"', '""')}"`
}

function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'the-foundry'
  )
}

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
