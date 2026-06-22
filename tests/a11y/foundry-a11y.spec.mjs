import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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
