import { spawn } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { expect } from '@playwright/test'
import { chromium } from 'playwright'

const repoRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const qaRoot = join(repoRoot, '.qa')
const dataRoot = join(qaRoot, 'smoke-data')
const artifactRoot = join(qaRoot, 'smoke-artifacts')
const host = '127.0.0.1'

function assertInsideRepo(targetPath) {
  const resolvedTarget = resolve(targetPath)
  const resolvedRepo = resolve(repoRoot)
  const pathFromRepo = relative(resolvedRepo, resolvedTarget)

  if (
    pathFromRepo === '' ||
    pathFromRepo.startsWith('..') ||
    isAbsolute(pathFromRepo)
  ) {
    throw new Error(`Refusing to clean a path outside the repo: ${targetPath}`)
  }
}

async function prepareCleanDir(targetPath) {
  assertInsideRepo(targetPath)
  await rm(targetPath, { force: true, recursive: true })
  await mkdir(targetPath, { recursive: true })
}

async function readDownload(download) {
  const downloadPath = await download.path()
  if (!downloadPath) {
    throw new Error('Download did not resolve to a local path')
  }

  return readFile(downloadPath, 'utf8')
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const body = await response.json().catch(() => null)
  return { body, response }
}

async function waitForServer(baseUrl, server) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exited) {
      throw new Error(`${server.name} server exited before it became ready`)
    }

    try {
      const response = await fetch(`${baseUrl}/api/meta`)
      if (response.ok) {
        return
      }
    } catch {
      // The server may still be starting.
    }

    await delay(250)
  }

  throw new Error(`${server.name} server did not become ready at ${baseUrl}`)
}

async function startServer(name, port) {
  const dataDir = join(dataRoot, name)
  await prepareCleanDir(dataDir)

  const stdout = createWriteStream(join(artifactRoot, `${name}.out.log`))
  const stderr = createWriteStream(join(artifactRoot, `${name}.err.log`))
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOST: host,
      OPENFORMS_DATA_DIR: dataDir,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  child.stdout.pipe(stdout)
  child.stderr.pipe(stderr)

  const server = {
    baseUrl: `http://${host}:${port}`,
    child,
    dataDir,
    exited: false,
    name,
  }

  child.once('exit', () => {
    server.exited = true
  })

  await waitForServer(server.baseUrl, server)
  return server
}

async function stopServer(server) {
  if (!server || server.exited) {
    return
  }

  server.child.kill()
  await Promise.race([once(server.child, 'exit'), delay(5_000)])
}

async function withBrowser(callback) {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    acceptDownloads: true,
    viewport: { width: 1366, height: 900 },
  })
  const consoleProblems = []

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    consoleProblems.push(`pageerror: ${error.message}`)
  })

  try {
    await callback(page)
    assert(
      consoleProblems.length === 0,
      `Console problems found:\n${consoleProblems.join('\n')}`,
    )
  } finally {
    await browser.close()
  }
}

async function runDemoWorkflow(baseUrl) {
  await withBrowser(async (page) => {
    await page.goto(baseUrl)
    await expect(page).toHaveTitle(/The Foundry/)
    await expect(
      page.getByRole('heading', { name: 'Choose your starting route' }),
    ).toBeVisible()

    await page.getByRole('button', { name: /Open demo workspace/ }).click()
    await expect(page.getByText('Demo workspace created')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('textbox', { name: 'Form title' })).toHaveValue(
      'Launch feedback demo',
    )
    await expect(page.getByRole('heading', { name: '3 submissions' })).toBeVisible()

    await page.getByRole('radio', { name: /Workbench/ }).check()
    await expect(page.locator('.save-state.saved')).toHaveText('Saved', {
      timeout: 15_000,
    })

    await page.getByRole('textbox', { name: 'Search responses' }).fill('Excellent')
    await expect(page.getByText('1 of 3 shown')).toBeVisible()

    const csvDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'CSV', exact: true }).click()
    const csv = await readDownload(await csvDownloadPromise)
    assert(csv.includes('Excellent'), 'Filtered CSV should include the searched answer')
    assert(!csv.includes('Good'), 'Filtered CSV should omit hidden responses')

    const jsonDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'JSON', exact: true }).click()
    const json = JSON.parse(await readDownload(await jsonDownloadPromise))
    assert(json.filters.visibleResponses === 1, 'JSON should describe the active filter')
    assert(json.responses.length === 1, 'JSON should include one filtered response')

    await page.getByRole('textbox', { name: 'Search responses' }).fill('nobody')
    await expect(page.getByText('No matching responses')).toBeVisible()
    await page.getByRole('textbox', { name: 'Search responses' }).clear()
    await expect(page.getByText('3 of 3 shown')).toBeVisible()

    const definitionDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export definition' }).click()
    const definition = JSON.parse(await readDownload(await definitionDownloadPromise))
    assert(definition.omitted.responses === true, 'Definition must omit responses')
    assert(definition.omitted.webhookUrl === true, 'Definition must omit webhook URLs')
    assert(
      definition.form.runnerBackgroundMood === 'workbench',
      'Definition should include the selected public mood',
    )
    assert(!('responses' in definition), 'Definition payload should not contain responses')
    assert(!('webhookUrl' in definition.form), 'Definition form should not contain webhookUrl')

    const definitionPath = join(artifactRoot, 'demo-definition-import.json')
    await writeFile(definitionPath, `${JSON.stringify(definition, null, 2)}\n`)
    await page
      .getByLabel('Import form definition JSON')
      .setInputFiles(definitionPath)
    await expect(page.getByText('Launch feedback demo imported as a draft')).toBeVisible()
    await expect(page.getByRole('heading', { name: '0 submissions' })).toBeVisible()

    const importedForms = await requestJson(`${baseUrl}/api/forms`)
    const imported = importedForms.body.find(
      (form) => form.title === 'Launch feedback demo' && form.status === 'draft',
    )
    assert(imported, 'Imported definition should create a draft form')
    assert(imported.responseCount === 0, 'Imported definition should not copy responses')
    assert(
      imported.runnerBackgroundMood === 'workbench',
      'Imported definition should preserve the public mood',
    )

    const invalidImport = await requestJson(`${baseUrl}/api/forms/import`, {
      body: JSON.stringify({
        exportVersion: 1,
        form: { fields: [] },
        source: 'the-foundry',
      }),
      method: 'POST',
    })
    assert(invalidImport.response.status === 400, 'Malformed imports should fail')

    const invalidMoodImport = await requestJson(`${baseUrl}/api/forms/import`, {
      body: JSON.stringify({
        ...definition,
        form: {
          ...definition.form,
          runnerBackgroundMood: 'maze',
        },
      }),
      method: 'POST',
    })
    assert(invalidMoodImport.response.status === 400, 'Invalid public moods should fail')

    await page.screenshot({
      fullPage: false,
      path: join(artifactRoot, 'demo-workflow.png'),
    })
  })
}

async function runBlankWorkflow(baseUrl) {
  await withBrowser(async (page) => {
    await page.goto(baseUrl)
    await expect(
      page.getByRole('heading', { name: 'Choose your starting route' }),
    ).toBeVisible()

    await page.getByRole('button', { name: /Blank form/ }).click()
    await expect(page.getByText('Form created')).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Form title' })).toHaveValue(
      'Untitled form',
    )

    await page
      .getByRole('textbox', { name: 'Form title' })
      .fill('First tester blank smoke')
    await page
      .getByRole('textbox', { name: 'Form description' })
      .fill('A tester-created form from the blank first-run path.')
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.locator('.save-state.saved')).toHaveText('Saved')

    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect(page.getByText('Public and accepting responses')).toBeVisible()

    const forms = await requestJson(`${baseUrl}/api/forms`)
    const form = forms.body.find((item) => item.title === 'First tester blank smoke')
    assert(form, 'Published blank smoke form should exist')
    assert(form.status === 'published', 'Blank smoke form should be published')

    await page.goto(`${baseUrl}/f/${form.id}`)
    await expect(page.getByRole('heading', { name: 'First tester blank smoke' })).toBeVisible()
    await page.getByRole('textbox', { name: /What should we call you/ }).fill('First Tester')
    await page.getByRole('button', { name: 'Submit' }).click()
    await expect(
      page.getByRole('heading', { name: 'Thanks, your response was recorded.' }),
    ).toBeVisible()

    await page.goto(baseUrl)
    await expect(page.getByRole('heading', { name: '1 submission' })).toBeVisible()
    await page.getByRole('button', { name: 'Select visible' }).click()
    await expect(page.getByText('1 selected')).toBeVisible()
    page.once('dialog', async (dialog) => {
      assert(
        dialog.message().includes('Delete 1 selected response'),
        'Delete confirmation should name the selected response count',
      )
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Delete selected' }).click()
    await expect(page.getByText('1 response deleted')).toBeVisible()
    await expect(page.getByRole('heading', { name: '0 submissions' })).toBeVisible()

    await page.screenshot({
      fullPage: false,
      path: join(artifactRoot, 'blank-workflow.png'),
    })
  })
}

async function main() {
  await prepareCleanDir(dataRoot)
  await prepareCleanDir(artifactRoot)

  const demoServer = await startServer('demo', 4192)
  try {
    await runDemoWorkflow(demoServer.baseUrl)
  } finally {
    await stopServer(demoServer)
  }

  const blankServer = await startServer('blank', 4193)
  try {
    await runBlankWorkflow(blankServer.baseUrl)
  } finally {
    await stopServer(blankServer)
  }

  console.log(`First-tester smoke passed. Artifacts: ${artifactRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
