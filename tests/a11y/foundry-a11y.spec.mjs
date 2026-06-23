import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'

const baseForm = {
  title: 'Accessibility smoke form',
  description: 'A stable form for automated keyboard and accessibility checks.',
  status: 'published',
  mode: 'flow',
  accentColor: '#087f7a',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  successMessage: 'Accessibility smoke submitted.',
  webhookUrl: '',
  fields: [
    {
      id: 'field_name',
      type: 'short_text',
      label: 'What should we call you?',
      placeholder: 'Name',
      required: true,
      options: [],
      position: 0,
    },
    {
      id: 'field_rating',
      type: 'rating',
      label: 'How useful was this?',
      placeholder: '',
      required: true,
      options: [],
      position: 1,
    },
  ],
}

async function createSmokeForm(request, overrides = {}) {
  const createdResponse = await request.post('/api/forms')
  expect(createdResponse.ok()).toBeTruthy()
  const created = await createdResponse.json()
  const suffix = created.id.slice(0, 8)
  const form = {
    ...created,
    ...baseForm,
    ...overrides,
    title: `${overrides.title ?? baseForm.title} ${suffix}`,
    fields: (overrides.fields ?? baseForm.fields).map((field, index) => ({
      ...field,
      id: `${field.id}_${suffix}`,
      position: index,
    })),
  }

  const savedResponse = await request.put(`/api/forms/${created.id}`, {
    data: form,
  })
  expect(savedResponse.ok()).toBeTruthy()

  return savedResponse.json()
}

async function submitSmokeResponse(request, form, name, rating) {
  const submittedResponse = await request.post(`/api/forms/${form.id}/responses`, {
    data: {
      answers: {
        [form.fields[0].id]: name,
        [form.fields[1].id]: rating,
      },
    },
  })
  expect(submittedResponse.ok()).toBeTruthy()

  return submittedResponse.json()
}

async function expectNoAxeViolations(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()

  expect(results.violations).toEqual([])
}

test('admin shell supports keyboard reorder and has no axe violations', async ({
  page,
  request,
}) => {
  const form = await createSmokeForm(request, {
    title: 'Admin accessibility smoke',
    status: 'draft',
  })

  await page.goto('/')
  await page.getByRole('button', { name: `${form.title}, draft, 0 responses` }).click()
  await expect(page.getByRole('heading', { name: '2 questions' })).toBeVisible()

  await page.locator('.field-stack')
    .getByRole('button', { name: 'Move What should we call you? down' })
    .click()
  await expect(page.locator('p[role="status"].sr-only')).toContainText(
    'What should we call you? moved to position 2 of 2.',
  )

  await page.keyboard.press('Tab')
  await expect(page.locator(':focus')).toBeVisible()

  await expectNoAxeViolations(page)

  const saved = await (await request.get(`/api/forms/${form.id}`)).json()
  expect(saved.fields[1].label).toBe('What should we call you?')
})

test('admin response workflow supports selection, bulk delete, and has no axe violations', async ({
  page,
  request,
}) => {
  const form = await createSmokeForm(request, {
    title: 'Response workflow smoke',
  })
  await submitSmokeResponse(request, form, 'Ada', 5)
  await submitSmokeResponse(request, form, 'Grace', 4)

  await page.goto('/')
  await page
    .getByRole('button', { name: `${form.title}, published, 2 responses` })
    .click()
  await expect(page.getByRole('heading', { name: '2 submissions' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeEnabled()

  await page.getByRole('textbox', { name: 'Search responses' }).fill('Ada')
  await expect(page.getByText('1 of 2 shown')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSV', exact: true }).click()
  const download = await downloadPromise
  const csvPath = await download.path()
  expect(csvPath).toBeTruthy()
  const csv = await readFile(csvPath, 'utf8')
  expect(csv).toContain('Ada')
  expect(csv).not.toContain('Grace')

  await page.getByRole('textbox', { name: 'Search responses' }).clear()
  await expect(page.getByText('2 of 2 shown')).toBeVisible()

  const firstResponseCheckbox = page
    .getByRole('checkbox', { name: /Select response submitted/ })
    .first()
  await firstResponseCheckbox.check()
  await expect(page.getByText('1 selected')).toBeVisible()

  await page.getByRole('button', { name: 'Select visible' }).click()
  await expect(page.getByText('2 selected')).toBeVisible()

  await page.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(page.getByText('0 selected')).toBeVisible()

  await firstResponseCheckbox.check()
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('Delete 1 selected response')
    await dialog.accept()
  })
  await page.getByRole('button', { name: 'Delete selected' }).click()
  await expect(page.getByText('1 response deleted')).toBeVisible()
  await expect(page.getByRole('heading', { name: '1 submission' })).toBeVisible()

  await expectNoAxeViolations(page)

  const remainingResponses = await (
    await request.get(`/api/forms/${form.id}/responses`)
  ).json()
  expect(remainingResponses).toHaveLength(1)
})

test('public runner exposes progress, required errors, and pressed states', async ({
  page,
  request,
}) => {
  const form = await createSmokeForm(request, {
    title: 'Runner accessibility smoke',
  })

  await page.goto(`/f/${form.id}`)
  await expect(page.getByRole('progressbar', { name: 'Form progress' })).toHaveAttribute(
    'aria-valuenow',
    '1',
  )

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('alert')).toHaveText('This question is required.')

  await page.getByRole('textbox', { name: /What should we call you/ }).fill('Ada')
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('progressbar', { name: 'Form progress' })).toHaveAttribute(
    'aria-valuenow',
    '2',
  )
  await expect(page.getByRole('button', { name: '3 out of 5' })).toHaveAttribute(
    'aria-pressed',
    'false',
  )

  await page.getByRole('button', { name: '3 out of 5' }).click()
  await expect(page.getByRole('button', { name: '3 out of 5' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await expectNoAxeViolations(page)
})
