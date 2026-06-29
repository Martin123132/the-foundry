import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type RefObject,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Circle,
  Copy,
  CopyPlus,
  Database,
  Download,
  Eye,
  FileText,
  GripVertical,
  Link2,
  ListChecks,
  Map as MapIcon,
  Palette,
  Plus,
  Rocket,
  Save,
  Search,
  Send,
  Settings,
  Share2,
  Sparkles,
  Redo2,
  Trash2,
  Undo2,
  Upload,
  Webhook,
} from 'lucide-react'
import './App.css'
import { api } from './api'
import { writeClipboardText } from './clipboard'
import {
  applyTemplate,
  copyField,
  createField,
  defaultOptions,
  fieldTypeLabel,
  fieldTypes,
  formTemplates,
  isOptionField,
  makeGuideState,
  sortFields,
  answerLabel,
  type FormTemplate,
  type GuideAction,
  type GuideSignal,
  type GuideStep,
} from './formModel'
import type {
  AnswerValue,
  AppMeta,
  FieldType,
  FormField,
  FormDefinitionPayload,
  FormMode,
  FormRecord,
  FormStatus,
  RunnerBackgroundMood,
  ResponseRecord,
} from './types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type ResponseFilter = 'all' | 'complete' | 'needs_answer'

const demoTemplateId = 'customer-feedback'
const defaultRunnerBackgroundMood: RunnerBackgroundMood = 'guided'

const themePresets = [
  {
    name: 'Foundry',
    accentColor: '#087f7a',
    backgroundColor: '#f7f8f8',
    textColor: '#1f2937',
    runnerBackgroundMood: 'guided' as RunnerBackgroundMood,
  },
  {
    name: 'Signal',
    accentColor: '#315c85',
    backgroundColor: '#f4f8fb',
    textColor: '#132235',
    runnerBackgroundMood: 'clean' as RunnerBackgroundMood,
  },
  {
    name: 'Field',
    accentColor: '#6f7c38',
    backgroundColor: '#fbfbf1',
    textColor: '#232818',
    runnerBackgroundMood: 'workbench' as RunnerBackgroundMood,
  },
  {
    name: 'Launch',
    accentColor: '#b64232',
    backgroundColor: '#fff7f5',
    textColor: '#2b1713',
    runnerBackgroundMood: 'complete' as RunnerBackgroundMood,
  },
]

const runnerBackgroundMoods: Array<{
  id: RunnerBackgroundMood
  label: string
  description: string
}> = [
  {
    id: 'guided',
    label: 'Guided path',
    description: 'Route lines and checkpoints for active forms.',
  },
  {
    id: 'clean',
    label: 'Clean light',
    description: 'Quiet surface for formal or low-noise forms.',
  },
  {
    id: 'workbench',
    label: 'Workbench',
    description: 'Builder texture for internal or operational forms.',
  },
  {
    id: 'complete',
    label: 'Completion bright',
    description: 'A finished path with a brighter checkpoint mood.',
  },
]

function App() {
  const formMatch = window.location.pathname.match(/^\/f\/([^/]+)/)

  if (formMatch) {
    return <PublicForm formId={formMatch[1]} />
  }

  return <AdminApp />
}

function AdminApp() {
  const [forms, setForms] = useState<FormRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<FormRecord | null>(null)
  const [appMeta, setAppMeta] = useState<AppMeta | null>(null)
  const [responses, setResponses] = useState<ResponseRecord[]>([])
  const [responseQuery, setResponseQuery] = useState('')
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>('all')
  const [selectedResponseIds, setSelectedResponseIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [responseActionBusy, setResponseActionBusy] = useState(false)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState('')
  const [pastForms, setPastForms] = useState<FormRecord[]>([])
  const [futureForms, setFutureForms] = useState<FormRecord[]>([])
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null)
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const saveTokenRef = useRef(0)
  const definitionImportRef = useRef<HTMLInputElement>(null)
  const selectAllResponsesRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const [items, meta] = await Promise.all([
          api.listForms(),
          api.getMeta().catch(() => null),
        ])
        if (!active) {
          return
        }
        setAppMeta(meta)
        setForms(items)
        setSelectedId((current) => current ?? items[0]?.id ?? null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load forms')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      return
    }

    let active = true
    const activeId = selectedId

    async function loadSelected() {
      setLoading(true)
      setError('')
      try {
        const [nextForm, nextResponses] = await Promise.all([
          api.getForm(activeId),
          api.listResponses(activeId),
        ])
        if (!active) {
          return
        }
        setForm(nextForm)
        setResponses(nextResponses)
        setResponseQuery('')
        setResponseFilter('all')
        setSelectedResponseIds(new Set())
        setSelectedFieldId(nextForm.fields[0]?.id ?? null)
        setDirty(false)
        setSaveState('saved')
        setLastSavedAt(nextForm.updatedAt)
        setPastForms([])
        setFutureForms([])
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load form')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadSelected()

    return () => {
      active = false
    }
  }, [selectedId])

  const orderedFields = useMemo(() => sortFields(form?.fields ?? []), [form])
  const selectedField = orderedFields.find((field) => field.id === selectedFieldId)
  const isPublished = form?.status === 'published'
  const normalizedResponseQuery = responseQuery.trim().toLowerCase()
  const responseStats = useMemo(() => {
    const withEmpty = responses.filter((response) =>
      responseHasEmptyAnswer(response, orderedFields),
    ).length

    return {
      complete: responses.length - withEmpty,
      needsAnswer: withEmpty,
    }
  }, [orderedFields, responses])
  const filteredResponses = useMemo(() => {
    return responses.filter((response) => {
      if (
        responseFilter === 'complete' &&
        responseHasEmptyAnswer(response, orderedFields)
      ) {
        return false
      }
      if (
        responseFilter === 'needs_answer' &&
        !responseHasEmptyAnswer(response, orderedFields)
      ) {
        return false
      }
      if (!normalizedResponseQuery) {
        return true
      }

      if (
        new Date(response.createdAt)
          .toLocaleString()
          .toLowerCase()
          .includes(normalizedResponseQuery)
      ) {
        return true
      }

      return orderedFields.some((field) => {
        const label = field.label.toLowerCase()
        const answer = answerLabel(response.answers[field.id]).toLowerCase()

        return (
          label.includes(normalizedResponseQuery) ||
          answer.includes(normalizedResponseQuery)
        )
      })
    })
  }, [normalizedResponseQuery, orderedFields, responseFilter, responses])
  const visibleResponseIds = useMemo(
    () => filteredResponses.map((response) => response.id),
    [filteredResponses],
  )
  const selectedResponseCount = selectedResponseIds.size
  const selectedVisibleCount = visibleResponseIds.filter((id) =>
    selectedResponseIds.has(id),
  ).length
  const allVisibleResponsesSelected =
    visibleResponseIds.length > 0 && selectedVisibleCount === visibleResponseIds.length
  const someVisibleResponsesSelected =
    selectedVisibleCount > 0 && !allVisibleResponsesSelected

  useEffect(() => {
    if (selectAllResponsesRef.current) {
      selectAllResponsesRef.current.indeterminate = someVisibleResponsesSelected
    }
  }, [someVisibleResponsesSelected])

  const shareUrl = form ? `${window.location.origin}/f/${form.id}` : ''
  const embedCode = form
    ? `<iframe src="${shareUrl}" title="${form.title}" style="width:100%;height:720px;border:0;border-radius:8px"></iframe>`
    : ''
  const guide = useMemo(
    () => (form ? makeGuideState(form, orderedFields, responses, dirty) : null),
    [dirty, form, orderedFields, responses],
  )
  const showFirstRunStarter =
    form?.title === 'Launch feedback' &&
    forms.length === 1 &&
    responses.length === 0 &&
    !dirty
  const saveStatusLabel =
    saveState === 'saving'
      ? 'Autosaving'
      : saveState === 'error'
        ? 'Save failed'
        : dirty
          ? 'Unsaved'
          : lastSavedAt
            ? 'Saved'
            : 'Ready'
  const canUndo = pastForms.length > 0
  const canRedo = futureForms.length > 0

  useEffect(() => {
    if (!form || !dirty || loading) {
      return
    }

    const nextForm = form
    const timeout = window.setTimeout(async () => {
      const token = saveTokenRef.current + 1
      saveTokenRef.current = token
      setSaveState('saving')
      setError('')
      try {
        const saved = await api.saveForm(nextForm.id, nextForm)
        if (saveTokenRef.current !== token) {
          return
        }
        setForm(saved)
        setForms((items) =>
          items.map((item) => (item.id === saved.id ? saved : item)),
        )
        setDirty(false)
        setSaveState('saved')
        setLastSavedAt(saved.updatedAt)
      } catch (saveError) {
        if (saveTokenRef.current !== token) {
          return
        }
        setSaveState('error')
        setError(saveError instanceof Error ? saveError.message : 'Could not save')
      }
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [dirty, form, loading])

  function updateForm(next: FormRecord, options: { history?: boolean } = {}) {
    const shouldTrack = options.history ?? true
    if (shouldTrack && form && form.id === next.id) {
      setPastForms((items) => [...items.slice(-39), form])
      setFutureForms([])
    }
    setForm(next)
    setDirty(true)
    setSaveState('idle')
  }

  function patchForm(patch: Partial<FormRecord>) {
    if (!form) {
      return
    }
    updateForm({ ...form, ...patch })
  }

  function patchSelectedField(patch: Partial<FormField>) {
    if (!form || !selectedField) {
      return
    }

    updateForm({
      ...form,
      fields: form.fields.map((field) =>
        field.id === selectedField.id ? { ...field, ...patch } : field,
      ),
    })
  }

  function undoFormChange() {
    if (!form || pastForms.length === 0) {
      return
    }

    const previous = pastForms[pastForms.length - 1]
    setPastForms((items) => items.slice(0, -1))
    setFutureForms((items) => [form, ...items.slice(0, 39)])
    setForm(previous)
    setSelectedFieldId((current) =>
      previous.fields.some((field) => field.id === current)
        ? current
        : previous.fields[0]?.id ?? null,
    )
    setDirty(true)
    setSaveState('idle')
  }

  function redoFormChange() {
    if (!form || futureForms.length === 0) {
      return
    }

    const next = futureForms[0]
    setFutureForms((items) => items.slice(1))
    setPastForms((items) => [...items.slice(-39), form])
    setForm(next)
    setSelectedFieldId((current) =>
      next.fields.some((field) => field.id === current)
        ? current
        : next.fields[0]?.id ?? null,
    )
    setDirty(true)
    setSaveState('idle')
  }

  async function saveCurrent(
    nextForm = form,
    options: { silent?: boolean } = {},
  ) {
    if (!nextForm) {
      return
    }

    const token = saveTokenRef.current + 1
    saveTokenRef.current = token
    if (!options.silent) {
      setSaving(true)
    }
    setSaveState('saving')
    setError('')
    try {
      const saved = await api.saveForm(nextForm.id, nextForm)
      if (saveTokenRef.current !== token) {
        return
      }
      setForm(saved)
      setForms((items) =>
        items.map((item) => (item.id === saved.id ? saved : item)),
      )
      setDirty(false)
      setSaveState('saved')
      setLastSavedAt(saved.updatedAt)
      if (!options.silent) {
        setNotice('Saved')
      }
    } catch (saveError) {
      if (saveTokenRef.current !== token) {
        return
      }
      setSaveState('error')
      setError(saveError instanceof Error ? saveError.message : 'Could not save')
    } finally {
      if (!options.silent) {
        setSaving(false)
      }
    }
  }

  async function createNewForm() {
    setSaving(true)
    setError('')
    try {
      const created = await api.createForm()
      setForms((items) => [created, ...items])
      setSelectedId(created.id)
      setNotice('Form created')
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create form')
    } finally {
      setSaving(false)
    }
  }

  async function createNewFormFromTemplate(template: FormTemplate) {
    setSaving(true)
    setError('')
    try {
      const created = await api.createForm()
      const templated = applyTemplate(created, template)
      const saved = await api.saveForm(created.id, templated)
      setForms((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
      setSelectedId(saved.id)
      setNotice(`${template.name} form created`)
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create form from template',
      )
    } finally {
      setSaving(false)
    }
  }

  async function createDemoWorkspace() {
    const template = formTemplates.find((item) => item.id === demoTemplateId)
    if (!template) {
      setError('Demo template is not available')
      return
    }

    setSaving(true)
    setError('')
    try {
      const created = await api.createForm()
      const templated = {
        ...applyTemplate(created, template),
        title: 'Launch feedback demo',
        description:
          'A ready-made sample workspace with a published form and local demo responses.',
        status: 'published' as FormStatus,
      }
      const saved = await api.saveForm(created.id, templated)
      const demoResponses = makeDemoResponses(saved.fields)

      for (const answers of demoResponses) {
        await api.submitResponse(saved.id, { answers })
      }

      const [nextForms, nextForm, nextResponses] = await Promise.all([
        api.listForms(),
        api.getForm(saved.id),
        api.listResponses(saved.id),
      ])
      setForms(nextForms)
      setSelectedId(saved.id)
      setForm(nextForm)
      setResponses(nextResponses)
      setResponseQuery('')
      setResponseFilter('all')
      setSelectedResponseIds(new Set())
      setSelectedFieldId(nextForm.fields[0]?.id ?? null)
      setDirty(false)
      setSaveState('saved')
      setLastSavedAt(nextForm.updatedAt)
      setPastForms([])
      setFutureForms([])
      setNotice('Demo workspace created')
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Could not create demo workspace',
      )
    } finally {
      setSaving(false)
    }
  }

  function addField(type: FieldType) {
    if (!form) {
      return
    }

    const nextField = createField(type, orderedFields.length)
    updateForm({
      ...form,
      fields: [...orderedFields, nextField].map((field, index) => ({
        ...field,
        position: index,
      })),
    })
    setSelectedFieldId(nextField.id)
  }

  function removeField(fieldId: string) {
    if (!form) {
      return
    }

    const nextFields = orderedFields
      .filter((field) => field.id !== fieldId)
      .map((field, index) => ({ ...field, position: index }))
    updateForm({ ...form, fields: nextFields })
    setSelectedFieldId(nextFields[0]?.id ?? null)
  }

  function duplicateField(fieldId: string) {
    if (!form) {
      return
    }

    const currentIndex = orderedFields.findIndex((field) => field.id === fieldId)
    if (currentIndex < 0) {
      return
    }

    const nextField = copyField(orderedFields[currentIndex], currentIndex + 1)
    const nextFields = [...orderedFields]
    nextFields.splice(currentIndex + 1, 0, nextField)
    updateForm({
      ...form,
      fields: nextFields.map((field, index) => ({ ...field, position: index })),
    })
    setSelectedFieldId(nextField.id)
  }

  function applyStarterTemplate(template: FormTemplate) {
    if (!form) {
      return
    }

    const needsConfirmation =
      orderedFields.length > 0 || responses.length > 0 || form.status === 'published'
    if (
      needsConfirmation &&
      !window.confirm(
        `Apply ${template.name}? This replaces current questions. Existing response labels may no longer match until you undo or export first.`,
      )
    ) {
      return
    }

    const nextForm = applyTemplate(form, template)
    updateForm(nextForm)
    setSelectedFieldId(nextForm.fields[0]?.id ?? null)
    setNotice(`${template.name} template applied`)
  }

  function moveField(fieldId: string, direction: -1 | 1) {
    if (!form) {
      return
    }

    const currentIndex = orderedFields.findIndex((field) => field.id === fieldId)
    const targetIndex = currentIndex + direction
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedFields.length) {
      return
    }

    const nextFields = [...orderedFields]
    const [field] = nextFields.splice(currentIndex, 1)
    nextFields.splice(targetIndex, 0, field)
    updateForm({
      ...form,
      fields: nextFields.map((item, index) => ({ ...item, position: index })),
    })
    setSelectedFieldId(fieldId)
    setReorderAnnouncement(
      `${field.label} moved to position ${targetIndex + 1} of ${orderedFields.length}.`,
    )
  }

  function reorderField(sourceId: string, targetId: string) {
    if (!form || sourceId === targetId) {
      setDraggedFieldId(null)
      return
    }

    const sourceIndex = orderedFields.findIndex((field) => field.id === sourceId)
    const targetIndex = orderedFields.findIndex((field) => field.id === targetId)
    if (sourceIndex < 0 || targetIndex < 0) {
      setDraggedFieldId(null)
      return
    }

    const nextFields = [...orderedFields]
    const [field] = nextFields.splice(sourceIndex, 1)
    nextFields.splice(targetIndex, 0, field)
    updateForm({
      ...form,
      fields: nextFields.map((item, index) => ({ ...item, position: index })),
    })
    setSelectedFieldId(sourceId)
    setReorderAnnouncement(
      `${field.label} moved to position ${targetIndex + 1} of ${orderedFields.length}.`,
    )
    setDraggedFieldId(null)
  }

  function beginFieldDrag(event: DragEvent<HTMLButtonElement>, fieldId: string) {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', fieldId)
    setDraggedFieldId(fieldId)
    setSelectedFieldId(fieldId)
  }

  async function togglePublished(status: FormStatus) {
    if (!form) {
      return
    }

    const nextForm = { ...form, status }
    updateForm(nextForm)
    await saveCurrent(nextForm)
  }

  async function copyShareUrl() {
    if (!shareUrl || !isPublished) {
      setNotice('Publish the form before sharing')
      return
    }

    const copied = await writeClipboardText(shareUrl)
    setNotice(copied ? 'Share link copied' : 'Select the link to copy')
  }

  async function copyEmbedCode() {
    if (!embedCode || !isPublished) {
      setNotice('Publish the form before sharing')
      return
    }

    const copied = await writeClipboardText(embedCode)
    setNotice(copied ? 'Embed copied' : 'Select the embed code')
  }

  async function copySettingValue(value: string, label: string) {
    const copied = await writeClipboardText(value)
    setNotice(copied ? `${label} copied` : `Select ${label.toLowerCase()} to copy`)
  }

  async function openRunnerPreview(kind: 'live' | 'draft' | 'compact') {
    if (!form) {
      return
    }

    if (kind === 'live' && !isPublished) {
      setNotice('Publish the form before opening the live runner')
      return
    }

    if (dirty) {
      await saveCurrent(form, { silent: true })
    }

    const query =
      kind === 'live'
        ? ''
        : kind === 'compact'
          ? '?preview=1&frame=compact'
          : '?preview=1'
    window.open(`/f/${form.id}${query}`, '_blank')
  }

  async function refreshResponses() {
    if (!form) {
      return
    }
    const nextResponses = await api.listResponses(form.id)
    setResponses(nextResponses)
    setSelectedResponseIds(new Set())
  }

  function toggleResponseSelection(responseId: string, checked: boolean) {
    setSelectedResponseIds((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(responseId)
      } else {
        next.delete(responseId)
      }
      return next
    })
  }

  function toggleVisibleResponseSelection() {
    setSelectedResponseIds((current) => {
      const next = new Set(current)
      if (allVisibleResponsesSelected) {
        for (const responseId of visibleResponseIds) {
          next.delete(responseId)
        }
      } else {
        for (const responseId of visibleResponseIds) {
          next.add(responseId)
        }
      }
      return next
    })
  }

  function clearResponseSelection() {
    setSelectedResponseIds(new Set())
  }

  async function deleteSelectedResponses() {
    if (!form || selectedResponseIds.size === 0) {
      return
    }

    const responseIds = [...selectedResponseIds]
    const count = responseIds.length
    const confirmed = window.confirm(
      `Delete ${count} selected response${count === 1 ? '' : 's'}? This cannot be undone.`,
    )
    if (!confirmed) {
      return
    }

    setResponseActionBusy(true)
    setError('')
    try {
      const result = await api.deleteResponses(form.id, responseIds)
      const deletedIds = new Set(responseIds)
      setResponses((items) => items.filter((item) => !deletedIds.has(item.id)))
      setForms((items) =>
        items.map((item) =>
          item.id === form.id
            ? {
                ...item,
                responseCount: Math.max(0, item.responseCount - result.deleted),
              }
            : item,
        ),
      )
      setForm((current) =>
        current?.id === form.id
          ? {
              ...current,
              responseCount: Math.max(0, current.responseCount - result.deleted),
            }
          : current,
      )
      setSelectedResponseIds(new Set())
      setNotice(
        `${result.deleted} response${result.deleted === 1 ? '' : 's'} deleted`,
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Could not delete selected responses',
      )
    } finally {
      setResponseActionBusy(false)
    }
  }

  async function exportFormDefinition() {
    if (!form) {
      return
    }

    if (dirty) {
      await saveCurrent(form, { silent: true })
    }

    window.location.href = api.exportDefinitionUrl(form.id)
    setNotice('Definition export prepared')
  }

  async function importFormDefinition(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const text = await file.text()
      let payload: unknown
      try {
        payload = JSON.parse(text) as FormDefinitionPayload
      } catch {
        throw new Error('Import file must be valid JSON')
      }

      const imported = await api.importFormDefinition(payload)
      setForms((items) => [imported, ...items.filter((item) => item.id !== imported.id)])
      setSelectedId(imported.id)
      setNotice(`${imported.title} imported as a draft`)
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Could not import definition',
      )
    } finally {
      setSaving(false)
      event.target.value = ''
    }
  }

  function exportVisibleResponsesCsv() {
    if (!form) {
      return
    }

    const headers = ['submitted_at', ...orderedFields.map((field) => field.label)]
    const lines = [
      headers.map(csvCell).join(','),
      ...filteredResponses.map((response) =>
        [
          response.createdAt,
          ...orderedFields.map((field) =>
            responseCsvValue(response.answers[field.id]),
          ),
        ]
          .map(csvCell)
          .join(','),
      ),
    ]

    downloadTextFile(
      `${lines.join('\n')}\n`,
      'text/csv;charset=utf-8',
      `${slugifyFileName(form.title)}-responses.csv`,
    )
    setNotice(
      `${filteredResponses.length} visible response${
        filteredResponses.length === 1 ? '' : 's'
      } exported as CSV`,
    )
  }

  function exportVisibleResponsesJson() {
    if (!form) {
      return
    }

    const payload = {
      exportVersion: 1,
      source: 'the-foundry',
      exportedAt: new Date().toISOString(),
      filters: {
        query: responseQuery.trim(),
        status: responseFilter,
        visibleResponses: filteredResponses.length,
        totalResponses: responses.length,
      },
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        status: form.status,
        mode: form.mode,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
        fields: orderedFields.map((field) => ({
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options,
          position: field.position,
        })),
      },
      responses: filteredResponses.map((response) => ({
        id: response.id,
        formId: response.formId,
        createdAt: response.createdAt,
        answers: orderedFields.map((field) => ({
          fieldId: field.id,
          label: field.label,
          type: field.type,
          value: response.answers[field.id] ?? '',
          displayValue: answerLabel(response.answers[field.id]),
        })),
      })),
    }
    downloadTextFile(
      `${JSON.stringify(payload, null, 2)}\n`,
      'application/json',
      `${slugifyFileName(form.title)}-responses.json`,
    )
    setNotice(`${filteredResponses.length} responses exported as JSON`)
  }

  async function runGuideAction(action: GuideAction) {
    if (!form) {
      return
    }

    if (action === 'save') {
      await saveCurrent()
      return
    }

    if (action === 'add-question') {
      addField('short_text')
      return
    }

    if (action === 'publish') {
      await togglePublished('published')
      return
    }

    if (action === 'preview') {
      window.open(`/f/${form.id}`, '_blank')
      return
    }

    window.location.href = api.exportCsvUrl(form.id)
  }

  if (loading && !form) {
    return <StatusScreen title="Opening The Foundry" body="Loading the workspace" />
  }

  if (!form) {
    return (
      <FirstRunWorkspace
        templates={formTemplates}
        saving={saving}
        error={error}
        onCreateBlank={createNewForm}
        onCreateDemo={createDemoWorkspace}
        onCreateFromTemplate={createNewFormFromTemplate}
      />
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">
            <ListChecks size={20} aria-hidden="true" />
          </div>
          <div>
            <p className="brand-name">The Foundry</p>
            <p className="brand-subtitle">Source-available forms and response workflows</p>
          </div>
        </div>
        <div className="topbar-actions">
          {notice ? (
            <span className="notice" role="status" aria-live="polite">
              {notice}
            </span>
          ) : null}
          <span className={`save-state ${saveState}`} role="status" aria-live="polite">
            {saveStatusLabel}
          </span>
          <div className="history-controls" aria-label="Edit history controls">
            <button
              type="button"
              className="icon-button"
              aria-label="Undo"
              title="Undo"
              onClick={undoFormChange}
              disabled={!canUndo}
            >
              <Undo2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="icon-button"
              aria-label="Redo"
              title="Redo"
              onClick={redoFormChange}
              disabled={!canRedo}
            >
              <Redo2 size={16} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="button ghost"
            onClick={() => window.open(`/f/${form.id}`, '_blank')}
          >
            <Eye size={16} aria-hidden="true" />
            Preview
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => void saveCurrent()}
            disabled={saving}
          >
            <Save size={16} aria-hidden="true" />
            {saving ? 'Saving' : 'Save'}
          </button>
        </div>
      </header>

      {error ? <div className="error-bar" role="alert">{error}</div> : null}

      <div className="studio-grid">
        <aside className="form-rail">
          <div className="rail-header">
            <div>
              <h2>Forms</h2>
              <p>{forms.length} total</p>
            </div>
            <button
              type="button"
              className="icon-button"
              aria-label="Create form"
              onClick={() => void createNewForm()}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="form-list">
            {forms.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`form-row ${item.id === form.id ? 'active' : ''}`}
                aria-current={item.id === form.id ? 'true' : undefined}
                aria-label={`${item.title}, ${item.status}, ${item.responseCount} responses`}
                onClick={() => setSelectedId(item.id)}
              >
                <span
                  className={`status-pin ${item.status}`}
                  aria-label={item.status}
                />
                <span className="form-row-copy">
                  <strong>{item.title}</strong>
                  <span>{item.responseCount} responses</span>
                </span>
              </button>
            ))}
          </div>

          <div className="rail-footer">
            <Database size={16} aria-hidden="true" />
            <span>SQLite file stored in this project.</span>
          </div>
        </aside>

        <main className="builder-surface">
          <section className="builder-header">
            <div className="title-fields">
              <input
                className="form-title-input"
                value={form.title}
                onChange={(event) => patchForm({ title: event.target.value })}
                aria-label="Form title"
              />
              <textarea
                className="form-description-input"
                value={form.description}
                onChange={(event) =>
                  patchForm({ description: event.target.value })
                }
                aria-label="Form description"
                rows={2}
              />
            </div>
            <div className="publish-box">
              <span className={`status-chip ${form.status}`}>
                {form.status === 'published' ? (
                  <CheckCircle2 size={15} aria-hidden="true" />
                ) : (
                  <Circle size={15} aria-hidden="true" />
                )}
                {form.status}
              </span>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  void togglePublished(
                    form.status === 'published' ? 'draft' : 'published',
                  )
                }
              >
                {form.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
            </div>
          </section>

          {guide ? (
            <GuidancePanel
              steps={guide.steps}
              signals={guide.signals}
              nextTitle={guide.nextTitle}
              nextBody={guide.nextBody}
              nextLabel={guide.nextLabel}
              nextAction={guide.nextAction}
              onAction={runGuideAction}
            />
          ) : null}

          {showFirstRunStarter ? (
            <FirstRunStarterPanel
              saving={saving}
              onCreateDemo={createDemoWorkspace}
              onCreateBlank={createNewForm}
            />
          ) : null}

          <TemplatePanel
            templates={formTemplates}
            onApply={applyStarterTemplate}
            onCreate={createNewFormFromTemplate}
          />

          <section className="canvas-panel">
            <div className="section-title">
              <div>
                <p>Question map</p>
                <h2>{orderedFields.length} questions</h2>
              </div>
              <Sparkles size={18} aria-hidden="true" />
            </div>

            <p id="reorder-instructions" className="sr-only">
              Drag a handle to reorder questions, or use the move up and move down buttons.
              Changes autosave and can be undone.
            </p>
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {reorderAnnouncement}
            </p>
            <div className="field-stack" aria-describedby="reorder-instructions">
              {orderedFields.map((field, index) => (
                <div
                  key={field.id}
                  className={`field-block ${
                    selectedFieldId === field.id ? 'selected' : ''
                  } ${draggedFieldId === field.id ? 'dragging' : ''} ${
                    draggedFieldId && draggedFieldId !== field.id ? 'drop-target' : ''
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                  onDragOver={(event) => {
                    if (draggedFieldId && draggedFieldId !== field.id) {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const sourceId =
                      event.dataTransfer.getData('text/plain') || draggedFieldId
                    if (sourceId) {
                      reorderField(sourceId, field.id)
                    }
                  }}
                >
                  <button
                    type="button"
                    className="drag-handle"
                    draggable
                    aria-label={`Drag ${field.label} to reorder`}
                    aria-describedby="reorder-instructions"
                    title="Drag to reorder"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedFieldId(field.id)
                    }}
                    onDragStart={(event) => beginFieldDrag(event, field.id)}
                    onDragEnd={() => setDraggedFieldId(null)}
                  >
                    <GripVertical size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="field-select-button"
                    aria-label={`Select ${field.label}`}
                    aria-pressed={selectedFieldId === field.id}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedFieldId(field.id)
                    }}
                  >
                    <span className="field-number">{index + 1}</span>
                    <span className="field-copy">
                      <strong>{field.label}</strong>
                      <span>{fieldTypeLabel(field.type)}</span>
                    </span>
                    {field.required ? <span className="required-mark">Required</span> : null}
                  </button>
                  <span className="field-reorder-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${field.label} up`}
                      aria-describedby="reorder-instructions"
                      title="Move up"
                      disabled={index === 0}
                      onClick={(event) => {
                        event.stopPropagation()
                        moveField(field.id, -1)
                      }}
                    >
                      <ChevronUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Move ${field.label} down`}
                      aria-describedby="reorder-instructions"
                      title="Move down"
                      disabled={index === orderedFields.length - 1}
                      onClick={(event) => {
                        event.stopPropagation()
                        moveField(field.id, 1)
                      }}
                    >
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            <div className="add-field-grid" aria-label="Add question type">
              {fieldTypes.map((fieldType) => (
                <button
                  key={fieldType.type}
                  type="button"
                  className="add-field-button"
                  onClick={() => addField(fieldType.type)}
                >
                  <Plus size={15} aria-hidden="true" />
                  <span>
                    <strong>{fieldType.label}</strong>
                    <small>{fieldType.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="responses-panel">
            <div className="section-title">
              <div>
                <p>Responses</p>
                <h2>
                  {responses.length} submission{responses.length === 1 ? '' : 's'}
                </h2>
              </div>
              <div className="inline-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Refresh responses"
                  onClick={() => void refreshResponses()}
                >
                  <BarChart3 size={17} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={exportVisibleResponsesCsv}
                  disabled={filteredResponses.length === 0}
                >
                  <Download size={16} aria-hidden="true" />
                  CSV
                </button>
                <button
                  type="button"
                  className="button ghost"
                  onClick={exportVisibleResponsesJson}
                  disabled={filteredResponses.length === 0}
                >
                  <FileText size={16} aria-hidden="true" />
                  JSON
                </button>
              </div>
            </div>

            <div className="response-tools">
              <label className="response-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">Search responses</span>
                <input
                  value={responseQuery}
                  placeholder="Search responses"
                  disabled={responses.length === 0}
                  onChange={(event) => setResponseQuery(event.target.value)}
                />
              </label>
              <div
                className="response-filter"
                role="group"
                aria-label="Filter responses by answer completeness"
              >
                <button
                  type="button"
                  className={responseFilter === 'all' ? 'active' : ''}
                  onClick={() => setResponseFilter('all')}
                  disabled={responses.length === 0}
                >
                  All <span>{responses.length}</span>
                </button>
                <button
                  type="button"
                  className={responseFilter === 'complete' ? 'active' : ''}
                  onClick={() => setResponseFilter('complete')}
                  disabled={responses.length === 0}
                >
                  Complete <span>{responseStats.complete}</span>
                </button>
                <button
                  type="button"
                  className={responseFilter === 'needs_answer' ? 'active' : ''}
                  onClick={() => setResponseFilter('needs_answer')}
                  disabled={responses.length === 0}
                >
                  Needs answer <span>{responseStats.needsAnswer}</span>
                </button>
              </div>
              <span className="response-result-count" aria-live="polite">
                {filteredResponses.length} of {responses.length} shown
              </span>
            </div>

            {responses.length > 0 ? (
              <div className="response-bulk-bar" aria-live="polite">
                <span className="response-bulk-summary">
                  {selectedResponseCount} selected
                </span>
                <div className="response-bulk-actions">
                  <button
                    type="button"
                    className="button ghost"
                    onClick={toggleVisibleResponseSelection}
                    disabled={filteredResponses.length === 0 || responseActionBusy}
                  >
                    {allVisibleResponsesSelected ? 'Clear visible' : 'Select visible'}
                  </button>
                  <button
                    type="button"
                    className="button ghost"
                    onClick={clearResponseSelection}
                    disabled={selectedResponseCount === 0 || responseActionBusy}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => void deleteSelectedResponses()}
                    disabled={selectedResponseCount === 0 || responseActionBusy}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    Delete selected
                  </button>
                </div>
              </div>
            ) : null}

            <div className="response-table-wrap">
              <table className="response-table">
                <thead>
                  <tr>
                    <th className="response-select-column">
                      <input
                        ref={selectAllResponsesRef}
                        className="response-checkbox"
                        type="checkbox"
                        aria-label="Select all visible responses"
                        checked={allVisibleResponsesSelected}
                        disabled={filteredResponses.length === 0 || responseActionBusy}
                        onChange={() => toggleVisibleResponseSelection()}
                      />
                    </th>
                    <th>Submitted</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <span className="response-empty-state">
                          <strong>No responses yet</strong>
                          <span>New submissions will appear here.</span>
                        </span>
                      </td>
                    </tr>
                  ) : filteredResponses.length === 0 ? (
                    <tr>
                      <td colSpan={3}>
                        <span className="response-empty-state">
                          <strong>No matching responses</strong>
                          <span>Try another search or filter.</span>
                        </span>
                      </td>
                    </tr>
                  ) : (
                    filteredResponses.map((response) => (
                      <tr
                        key={response.id}
                        className={
                          selectedResponseIds.has(response.id) ? 'selected' : ''
                        }
                      >
                        <td className="response-select-cell">
                          <input
                            className="response-checkbox"
                            type="checkbox"
                            aria-label={`Select response submitted ${new Date(
                              response.createdAt,
                            ).toLocaleString()}`}
                            checked={selectedResponseIds.has(response.id)}
                            disabled={responseActionBusy}
                            onChange={(event) =>
                              toggleResponseSelection(
                                response.id,
                                event.target.checked,
                              )
                            }
                          />
                        </td>
                        <td>{new Date(response.createdAt).toLocaleString()}</td>
                        <td>
                          {orderedFields.map((field) => (
                            <span key={field.id} className="answer-pill">
                              {field.label}: {answerLabel(response.answers[field.id])}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        <aside className="inspector">
          <section className="inspector-section">
            <div className="section-title compact">
              <div>
                <p>Question</p>
                <h2>{selectedField ? selectedField.label : 'Nothing selected'}</h2>
              </div>
              <Settings size={18} aria-hidden="true" />
            </div>

            {selectedField ? (
              <FieldInspector
                field={selectedField}
                onPatch={patchSelectedField}
                onRemove={() => removeField(selectedField.id)}
                onDuplicate={() => duplicateField(selectedField.id)}
                onMoveUp={() => moveField(selectedField.id, -1)}
                onMoveDown={() => moveField(selectedField.id, 1)}
              />
            ) : (
              <p className="empty-copy">Add a question to edit its settings.</p>
            )}
          </section>

          <section className="inspector-section">
            <div className="section-title compact">
              <div>
                <p>Share</p>
                <h2>Public link</h2>
              </div>
              <Link2 size={18} aria-hidden="true" />
            </div>
            <div className={`share-status ${isPublished ? 'published' : 'draft'}`}>
              {isPublished ? (
                <CheckCircle2 size={17} aria-hidden="true" />
              ) : (
                <Circle size={17} aria-hidden="true" />
              )}
              <span>
                <strong>{isPublished ? 'Public and accepting responses' : 'Draft - sharing disabled'}</strong>
                <small>
                  {isPublished
                    ? 'Anyone with the link can submit this form.'
                    : 'Publish the form to unlock the public link and embed.'}
                </small>
              </span>
            </div>
            <div className="share-box">
              <input
                value={shareUrl}
                readOnly
                aria-label="Share URL"
                aria-describedby="share-state-note"
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Copy share URL"
                onClick={() => void copyShareUrl()}
                disabled={!isPublished}
              >
                <Copy size={16} aria-hidden="true" />
              </button>
            </div>
            <p id="share-state-note" className="share-state-note">
              {isPublished
                ? 'This URL is live. Unpublishing immediately closes submissions.'
                : 'The URL is reserved, but public visitors cannot submit until you publish.'}
            </p>
            <label className="field-label">
              Embed
              <textarea
                className="embed-code"
                value={embedCode}
                readOnly
                rows={4}
                disabled={!isPublished}
              />
            </label>
            <button
              type="button"
              className="button ghost"
              onClick={() => void copyEmbedCode()}
              disabled={!isPublished}
            >
              <Copy size={16} aria-hidden="true" />
              Copy embed
            </button>
            <div className="preview-actions" aria-label="Preview public form">
              <button
                type="button"
                className="button ghost"
                onClick={() => void openRunnerPreview('live')}
                disabled={!isPublished}
              >
                <Eye size={16} aria-hidden="true" />
                Live
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => void openRunnerPreview('draft')}
              >
                <FileText size={16} aria-hidden="true" />
                Draft
              </button>
              <button
                type="button"
                className="button ghost"
                onClick={() => void openRunnerPreview('compact')}
              >
                <Sparkles size={16} aria-hidden="true" />
                Compact
              </button>
            </div>
            <p className="preview-note">
              Draft and compact previews do not save responses.
            </p>
          </section>

          <DefinitionTransfer
            inputRef={definitionImportRef}
            onExport={exportFormDefinition}
            onImport={(event) => void importFormDefinition(event)}
            onOpenImport={() => definitionImportRef.current?.click()}
          />

          <section className="inspector-section">
            <div className="section-title compact">
              <div>
                <p>Theme</p>
                <h2>Presentation</h2>
              </div>
              <Palette size={18} aria-hidden="true" />
            </div>
            <div className="theme-presets" aria-label="Theme presets">
              {themePresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="theme-preset-button"
                  onClick={() =>
                    patchForm({
                      accentColor: preset.accentColor,
                      backgroundColor: preset.backgroundColor,
                      textColor: preset.textColor,
                      runnerBackgroundMood: preset.runnerBackgroundMood,
                    })
                  }
                >
                  <span className="theme-preset-swatches" aria-hidden="true">
                    <span style={{ background: preset.accentColor }} />
                    <span style={{ background: preset.backgroundColor }} />
                    <span style={{ background: preset.textColor }} />
                    <span
                      className={`mood-swatch ${runnerBackgroundMoodClass(
                        preset.runnerBackgroundMood,
                      )}`}
                    />
                  </span>
                  {preset.name}
                </button>
              ))}
            </div>
            <fieldset className="background-mood-field">
              <legend>Public mood</legend>
              <div className="background-mood-grid">
                {runnerBackgroundMoods.map((mood) => {
                  const checked =
                    (form.runnerBackgroundMood ?? defaultRunnerBackgroundMood) === mood.id

                  return (
                    <label
                      key={mood.id}
                      className={`background-mood-card ${checked ? 'active' : ''}`}
                    >
                      <input
                        type="radio"
                        name="runner-background-mood"
                        value={mood.id}
                        checked={checked}
                        onChange={() => patchForm({ runnerBackgroundMood: mood.id })}
                      />
                      <span
                        className={`background-mood-preview ${runnerBackgroundMoodClass(
                          mood.id,
                        )}`}
                        aria-hidden="true"
                      />
                      <span>
                        <strong>{mood.label}</strong>
                        <small>{mood.description}</small>
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <ThemeControl
              label="Accent"
              value={form.accentColor}
              onChange={(accentColor) => patchForm({ accentColor })}
            />
            <ThemeControl
              label="Background"
              value={form.backgroundColor}
              onChange={(backgroundColor) => patchForm({ backgroundColor })}
            />
            <ThemeControl
              label="Text"
              value={form.textColor}
              onChange={(textColor) => patchForm({ textColor })}
            />
            <div className="field-label">
              Mode
              <div className="segmented-control" role="group" aria-label="Form mode">
                <button
                  type="button"
                  className={form.mode === 'flow' ? 'active' : ''}
                  onClick={() => patchForm({ mode: 'flow' })}
                >
                  <ArrowRight size={15} aria-hidden="true" />
                  Flow
                </button>
                <button
                  type="button"
                  className={form.mode === 'classic' ? 'active' : ''}
                  onClick={() => patchForm({ mode: 'classic' })}
                >
                  <FileText size={15} aria-hidden="true" />
                  Classic
                </button>
              </div>
              <select
                className="mode-select-fallback"
                aria-label="Form mode"
                value={form.mode}
                onChange={(event) => patchForm({ mode: event.target.value as FormMode })}
              >
                <option value="flow">One question flow</option>
                <option value="classic">Classic page</option>
              </select>
            </div>
          </section>

          <section className="inspector-section">
            <div className="section-title compact">
              <div>
                <p>Delivery</p>
                <h2>Webhook</h2>
              </div>
              <Webhook size={18} aria-hidden="true" />
            </div>
            <label className="field-label">
              Webhook URL
              <input
                value={form.webhookUrl}
                placeholder="https://example.com/hook"
                onChange={(event) => patchForm({ webhookUrl: event.target.value })}
              />
            </label>
            <label className="field-label">
              Success message
              <textarea
                value={form.successMessage}
                rows={3}
                onChange={(event) =>
                  patchForm({ successMessage: event.target.value })
                }
              />
            </label>
            <label className="field-label">
              Closed message
              <textarea
                value={form.closedMessage}
                rows={3}
                onChange={(event) =>
                  patchForm({ closedMessage: event.target.value })
                }
              />
            </label>
          </section>

          <OperationsSettings
            meta={appMeta}
            onCopy={copySettingValue}
          />
        </aside>
      </div>
    </div>
  )
}

function GuidancePanel({
  steps,
  signals,
  nextTitle,
  nextBody,
  nextLabel,
  nextAction,
  onAction,
}: {
  steps: GuideStep[]
  signals: GuideSignal[]
  nextTitle: string
  nextBody: string
  nextLabel: string
  nextAction: GuideAction
  onAction: (action: GuideAction) => Promise<void>
}) {
  const completeCount = steps.filter((step) => step.done).length
  const progressLabel = `${completeCount} of ${steps.length} launch checks ready`

  return (
    <section className="guide-panel">
      <div className="guide-header">
        <div className="guide-title">
          <div className="guide-compass">
            <Compass size={19} aria-hidden="true" />
          </div>
          <div>
            <p>Launch path</p>
            <h2>{nextTitle}</h2>
            <span>{progressLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="button primary"
          onClick={() => void onAction(nextAction)}
        >
          {nextAction === 'publish' ? (
            <Rocket size={16} aria-hidden="true" />
          ) : nextAction === 'preview' ? (
            <Eye size={16} aria-hidden="true" />
          ) : nextAction === 'export' ? (
            <Download size={16} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          {nextLabel}
        </button>
      </div>
      <p className="guide-next-copy">{nextBody}</p>
      <ul className="guide-signals" aria-label="Launch readiness signals">
        {signals.map((signal) => (
          <li key={signal.id} className={signal.done ? 'done' : ''}>
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
          </li>
        ))}
      </ul>
      <ol className="guide-steps" aria-label="Launch path progress">
        {steps.map((step, index) => (
          <li key={step.id} className={step.done ? 'done' : ''}>
            <GuideStepIcon id={step.id} done={step.done} />
            <span>
              <strong>{step.label}</strong>
              <em>{step.detail}</em>
            </span>
            <small>{index + 1}</small>
          </li>
        ))}
      </ol>
      <div
        className="guide-progress"
        role="progressbar"
        aria-label="Launch progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completeCount}
      >
        <span style={{ width: `${(completeCount / steps.length) * 100}%` }} />
      </div>
    </section>
  )
}

function FirstRunWorkspace({
  templates,
  saving,
  error,
  onCreateBlank,
  onCreateDemo,
  onCreateFromTemplate,
}: {
  templates: FormTemplate[]
  saving: boolean
  error: string
  onCreateBlank: () => Promise<void>
  onCreateDemo: () => Promise<void>
  onCreateFromTemplate: (template: FormTemplate) => Promise<void>
}) {
  return (
    <main className="first-run-shell">
      <section className="first-run-intro" aria-labelledby="first-run-title">
        <div className="brand-mark large">
          <ListChecks size={26} aria-hidden="true" />
        </div>
        <div>
          <p>First run</p>
          <h1 id="first-run-title">Start with a working path</h1>
          <span>
            Pick a starter, open a demo workspace, or begin from a blank form.
          </span>
        </div>
      </section>
      {error ? (
        <div className="first-run-error" role="alert">
          {error}
        </div>
      ) : null}

      <section className="first-run-actions" aria-label="Recommended starts">
        <button
          type="button"
          className="first-run-action primary"
          onClick={() => void onCreateDemo()}
          disabled={saving}
        >
          <Rocket size={19} aria-hidden="true" />
          <span>
            <strong>Open demo workspace</strong>
            <small>Published sample form with local responses.</small>
          </span>
        </button>
        <button
          type="button"
          className="first-run-action"
          onClick={() => void onCreateBlank()}
          disabled={saving}
        >
          <Plus size={19} aria-hidden="true" />
          <span>
            <strong>Blank form</strong>
            <small>Start with one editable question.</small>
          </span>
        </button>
      </section>

      <section className="first-run-templates" aria-labelledby="first-run-templates-title">
        <div className="section-title">
          <div>
            <p>Starter paths</p>
            <h2 id="first-run-templates-title">Templates</h2>
          </div>
          <Sparkles size={18} aria-hidden="true" />
        </div>
        <div className="template-grid compact">
          {templates.map((template) => (
            <article className="template-card" key={template.id}>
              <button
                type="button"
                className="template-button"
                onClick={() => void onCreateFromTemplate(template)}
                disabled={saving}
              >
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.description}</small>
                </span>
                <span className="template-meta">
                  {template.fields.length} fields
                </span>
              </button>
              <button
                type="button"
                className="template-create-button"
                onClick={() => void onCreateFromTemplate(template)}
                disabled={saving}
              >
                <Plus size={15} aria-hidden="true" />
                New
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function FirstRunStarterPanel({
  saving,
  onCreateDemo,
  onCreateBlank,
}: {
  saving: boolean
  onCreateDemo: () => Promise<void>
  onCreateBlank: () => Promise<void>
}) {
  return (
    <section className="first-run-panel" aria-labelledby="first-run-panel-title">
      <div className="section-title">
        <div>
          <p>First run</p>
          <h2 id="first-run-panel-title">Choose your starting route</h2>
        </div>
        <Compass size={18} aria-hidden="true" />
      </div>
      <p>
        This install starts with a live feedback form. Add sample responses for a
        quick product tour, or open a clean blank form.
      </p>
      <div className="first-run-actions compact">
        <button
          type="button"
          className="first-run-action primary"
          onClick={() => void onCreateDemo()}
          disabled={saving}
        >
          <Rocket size={19} aria-hidden="true" />
          <span>
            <strong>Open demo workspace</strong>
            <small>Creates a sample form with local responses.</small>
          </span>
        </button>
        <button
          type="button"
          className="first-run-action"
          onClick={() => void onCreateBlank()}
          disabled={saving}
        >
          <Plus size={19} aria-hidden="true" />
          <span>
            <strong>Blank form</strong>
            <small>Start fresh and shape your own route.</small>
          </span>
        </button>
      </div>
    </section>
  )
}

function GuideStepIcon({
  id,
  done,
}: {
  id: GuideStep['id']
  done: boolean
}) {
  if (done) {
    return <CheckCircle2 size={17} aria-hidden="true" />
  }

  if (id === 'shape') {
    return <MapIcon size={17} aria-hidden="true" />
  }
  if (id === 'publish') {
    return <Rocket size={17} aria-hidden="true" />
  }
  if (id === 'share') {
    return <Share2 size={17} aria-hidden="true" />
  }
  if (id === 'collect') {
    return <BarChart3 size={17} aria-hidden="true" />
  }
  return <Download size={17} aria-hidden="true" />
}

function TemplatePanel({
  templates,
  onApply,
  onCreate,
}: {
  templates: FormTemplate[]
  onApply: (template: FormTemplate) => void
  onCreate: (template: FormTemplate) => void
}) {
  return (
    <section className="template-panel">
      <div className="section-title">
        <div>
          <p>Starter paths</p>
          <h2>Templates</h2>
        </div>
        <FileText size={18} aria-hidden="true" />
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <article
            key={template.id}
            className="template-card"
          >
            <button
              type="button"
              className="template-button"
              onClick={() => onApply(template)}
            >
              <span>
                <strong>{template.name}</strong>
                <small>{template.description}</small>
              </span>
              <span className="template-meta">
                {template.fields.length} fields
              </span>
            </button>
            <button
              type="button"
              className="template-create-button"
              onClick={() => onCreate(template)}
            >
              <Plus size={14} aria-hidden="true" />
              New
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

function FieldInspector({
  field,
  onPatch,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: {
  field: FormField
  onPatch: (patch: Partial<FormField>) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  function handleOptions(event: ChangeEvent<HTMLTextAreaElement>) {
    onPatch({
      options: event.target.value
        .split('\n')
        .map((option) => option.trim())
        .filter(Boolean),
    })
  }

  return (
    <div className="inspector-stack">
      <label className="field-label">
        Type
        <select
          value={field.type}
          onChange={(event) =>
            onPatch({
              type: event.target.value as FieldType,
              options: isOptionField(event.target.value as FieldType)
                ? field.options.length > 0
                  ? field.options
                  : defaultOptions
                : [],
            })
          }
        >
          {fieldTypes.map((item) => (
            <option value={item.type} key={item.type}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field-label">
        Label
        <input
          value={field.label}
          onChange={(event) => onPatch({ label: event.target.value })}
        />
      </label>
      <label className="field-label">
        Placeholder
        <input
          value={field.placeholder}
          onChange={(event) => onPatch({ placeholder: event.target.value })}
        />
      </label>
      {isOptionField(field.type) ? (
        <label className="field-label">
          Options
          <textarea
            rows={4}
            value={field.options.join('\n')}
            onChange={handleOptions}
          />
        </label>
      ) : null}
      <label className="check-row">
        <input
          type="checkbox"
          checked={field.required}
          onChange={(event) => onPatch({ required: event.target.checked })}
        />
        Required answer
      </label>
      <div className="inspector-actions">
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${field.label} up`}
          onClick={onMoveUp}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label={`Move ${field.label} down`}
          onClick={onMoveDown}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="button ghost" onClick={onDuplicate}>
          <CopyPlus size={16} aria-hidden="true" />
          Duplicate
        </button>
        <button type="button" className="button danger" onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
          Delete
        </button>
      </div>
    </div>
  )
}

function DefinitionTransfer({
  inputRef,
  onExport,
  onImport,
  onOpenImport,
}: {
  inputRef: RefObject<HTMLInputElement | null>
  onExport: () => Promise<void>
  onImport: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenImport: () => void
}) {
  return (
    <section className="inspector-section">
      <div className="section-title compact">
        <div>
          <p>Definition</p>
          <h2>Move form</h2>
        </div>
        <FileText size={18} aria-hidden="true" />
      </div>
      <div className="definition-transfer">
        <button type="button" className="button ghost" onClick={() => void onExport()}>
          <Download size={16} aria-hidden="true" />
          Export definition
        </button>
        <button type="button" className="button ghost" onClick={onOpenImport}>
          <Upload size={16} aria-hidden="true" />
          Import draft
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Import form definition JSON"
          className="sr-only"
          onChange={onImport}
        />
      </div>
      <p className="definition-note">
        Moves questions, copy, mode, colors, and public mood. Responses and webhook
        URLs stay out of the export.
      </p>
    </section>
  )
}

function ThemeControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="theme-control">
      <span>{label}</span>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function OperationsSettings({
  meta,
  onCopy,
}: {
  meta: AppMeta | null
  onCopy: (value: string, label: string) => Promise<void>
}) {
  return (
    <section className="inspector-section">
      <div className="section-title compact">
        <div>
          <p>Settings</p>
          <h2>Operations</h2>
        </div>
        <Database size={18} aria-hidden="true" />
      </div>

      {meta ? (
        <div className="ops-stack">
          <div className="ops-card">
            <p>Storage</p>
            <dl>
              <div>
                <dt>Mode</dt>
                <dd>{meta.storageMode.toUpperCase()}</dd>
              </div>
              <div>
                <dt>Data directory</dt>
                <dd>
                  <code>{meta.dataDir}</code>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Copy data directory"
                    onClick={() => void onCopy(meta.dataDir, 'Data directory')}
                  >
                    <Copy size={14} aria-hidden="true" />
                  </button>
                </dd>
              </div>
              <div>
                <dt>Database file</dt>
                <dd>
                  <code>{meta.databaseFile}</code>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Copy database file"
                    onClick={() => void onCopy(meta.databaseFile, 'Database file')}
                  >
                    <Copy size={14} aria-hidden="true" />
                  </button>
                </dd>
              </div>
            </dl>
          </div>

          <div className="ops-card">
            <p>Environment</p>
            <dl>
              <div>
                <dt>Bind</dt>
                <dd>
                  {meta.environment.host}:{meta.environment.port}
                </dd>
              </div>
              <div>
                <dt>Data env</dt>
                <dd>
                  <code>{meta.environment.dataDirVariable}</code>
                </dd>
              </div>
            </dl>
          </div>

          <div className="ops-card">
            <p>New form defaults</p>
            <dl>
              <div>
                <dt>Status</dt>
                <dd>{meta.defaults.newFormStatus}</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>{meta.defaults.mode}</dd>
              </div>
              <div>
                <dt>Theme</dt>
                <dd className="ops-swatches">
                  <span style={{ background: meta.defaults.accentColor }} />
                  <span style={{ background: meta.defaults.backgroundColor }} />
                  <span style={{ background: meta.defaults.textColor }} />
                </dd>
              </div>
              <div>
                <dt>Public mood</dt>
                <dd>{runnerBackgroundMoodLabel(meta.defaults.runnerBackgroundMood)}</dd>
              </div>
            </dl>
          </div>
        </div>
      ) : (
        <p className="empty-copy">Operational settings are unavailable.</p>
      )}
    </section>
  )
}

function PublicForm({ formId }: { formId: string }) {
  const previewParams = new URLSearchParams(window.location.search)
  const isPreview = previewParams.get('preview') === '1'
  const isCompactPreview = previewParams.get('frame') === 'compact'
  const [form, setForm] = useState<FormRecord | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [honeypot, setHoneypot] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const runnerQuestionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true

    async function load() {
      try {
        const nextForm = await api.getForm(formId)
        if (active) {
          setForm(nextForm)
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Form not found')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [formId])

  const orderedFields = useMemo(() => sortFields(form?.fields ?? []), [form])
  const currentField = orderedFields[step]
  const hasFields = orderedFields.length > 0
  const runnerMoodClass = runnerBackgroundMoodClass(
    form?.runnerBackgroundMood ?? defaultRunnerBackgroundMood,
  )

  useEffect(() => {
    const target = runnerQuestionRef.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement
    >('input:not([type="hidden"]), textarea, select, button:not([disabled])')

    target?.focus()
  }, [form?.id, step])

  function setAnswer(fieldId: string, value: AnswerValue) {
    setAnswers((current) => ({ ...current, [fieldId]: value }))
    setError('')
  }

  function fieldIsComplete(field: FormField) {
    const value = answers[field.id]
    if (!field.required) {
      return true
    }
    if (Array.isArray(value)) {
      return value.length > 0
    }
    return value !== undefined && String(value).trim().length > 0
  }

  function validateAll() {
    return orderedFields.every(fieldIsComplete)
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    if (!hasFields) {
      setError('Add at least one question before collecting responses.')
      return
    }
    if (!validateAll()) {
      setError('Please answer all required questions.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      if (!isPreview) {
        await api.submitResponse(formId, { answers, honeypot })
      }
      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <StatusScreen title="Opening form" body="Loading the questions" />
  }

  if (!form || error === 'Form not found') {
    return <StatusScreen title="Form not found" body="This form does not exist." />
  }

  if (form.status !== 'published' && !isPreview) {
    return (
      <div
        className={`public-shell closed-shell ${runnerMoodClass}`}
        style={{
          backgroundColor: form.backgroundColor,
          color: form.textColor,
          ['--runner-accent' as string]: form.accentColor,
        }}
      >
        <section className="success-state closed-state">
          <span className="state-icon closed">
            <Circle size={34} aria-hidden="true" />
          </span>
          <h1>Submissions are closed</h1>
          <p>{form.closedMessage}</p>
        </section>
      </div>
    )
  }

  if (submitted) {
    return (
      <div
        className={`public-shell submitted-shell ${runnerMoodClass}`}
        style={{
          backgroundColor: form.backgroundColor,
          color: form.textColor,
          ['--runner-accent' as string]: form.accentColor,
        }}
      >
        <section className="success-state submitted-state">
          <span className="state-icon submitted">
            <CheckCircle2 size={34} aria-hidden="true" />
          </span>
          <h1>{form.successMessage}</h1>
          <p>{isPreview ? 'Preview complete. No response was saved.' : form.title}</p>
          <a className="button primary" href="/">
            Back to studio
          </a>
        </section>
      </div>
    )
  }

  return (
    <div
      className={`public-shell ${runnerMoodClass} ${
        isCompactPreview ? 'compact-preview' : ''
      }`}
      style={{
        backgroundColor: form.backgroundColor,
        color: form.textColor,
        ['--runner-accent' as string]: form.accentColor,
      }}
    >
      <form className="runner" onSubmit={(event) => void submit(event)}>
        <header className="runner-header">
          {isPreview ? (
            <p className="preview-ribbon" role="status">
              Preview mode - responses are not saved
            </p>
          ) : null}
          <a className="back-link" href="/">
            <ArrowLeft size={16} aria-hidden="true" />
            Studio
          </a>
          <div>
            <h1>{form.title}</h1>
            <p>{form.description}</p>
          </div>
          <div
            className="progress-meter"
            role="progressbar"
            aria-label="Form progress"
            aria-valuemin={0}
            aria-valuemax={orderedFields.length}
            aria-valuenow={
              form.mode === 'classic'
                ? orderedFields.length
                : Math.min(step + 1, orderedFields.length)
            }
          >
            <span
              style={{
                width: `${Math.round(
                  ((form.mode === 'classic' ? orderedFields.length : step + 1) /
                    Math.max(orderedFields.length, 1)) *
                    100,
                )}%`,
              }}
            />
          </div>
          {form.mode === 'flow' ? (
            <nav className="runner-step-map" aria-label="Question map">
              {orderedFields.map((field, index) => (
                <button
                  type="button"
                  key={field.id}
                  className={`${index === step ? 'active' : ''} ${
                    fieldIsComplete(field) ? 'complete' : ''
                  }`}
                  aria-current={index === step ? 'step' : undefined}
                  aria-label={`Question ${index + 1}: ${field.label}`}
                  onClick={() => setStep(index)}
                >
                  <span>{index + 1}</span>
                  <small>{fieldTypeLabel(field.type)}</small>
                </button>
              ))}
            </nav>
          ) : null}
        </header>

        <input
          className="honeypot"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          autoComplete="off"
          tabIndex={-1}
          aria-hidden="true"
        />

        {orderedFields.length === 0 ? (
          <div className="runner-empty-state" role="status">
            <strong>No questions yet</strong>
            <span>Add a question in the studio before sharing this form.</span>
          </div>
        ) : form.mode === 'classic' ? (
          <div className="classic-stack" ref={runnerQuestionRef}>
            {orderedFields.map((field) => (
              <RunnerField
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(value) => setAnswer(field.id, value)}
              />
            ))}
          </div>
        ) : currentField ? (
          <div ref={runnerQuestionRef}>
            <RunnerField
              field={currentField}
              value={answers[currentField.id]}
              onChange={(value) => setAnswer(currentField.id, value)}
              index={step + 1}
              total={orderedFields.length}
            />
          </div>
        ) : null}

        {error ? <p className="runner-error" role="alert">{error}</p> : null}

        <footer className="runner-actions">
          {form.mode === 'flow' ? (
            <>
              <button
                type="button"
                className="button ghost"
                  disabled={step === 0 || !hasFields}
                onClick={() => setStep((current) => Math.max(current - 1, 0))}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back
              </button>
              {step < orderedFields.length - 1 ? (
                <button
                  type="button"
                  className="button primary"
                  onClick={() => {
                    if (!currentField || fieldIsComplete(currentField)) {
                      setStep((current) => current + 1)
                    } else {
                      setError('This question is required.')
                    }
                  }}
                >
                  Next
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="button primary"
                  disabled={submitting || !hasFields}
                >
                  <Send size={16} aria-hidden="true" />
                  {submitting ? 'Sending' : 'Submit'}
                </button>
              )}
            </>
          ) : (
            <button
              type="submit"
              className="button primary"
              disabled={submitting || !hasFields}
            >
              <Send size={16} aria-hidden="true" />
              {submitting ? 'Sending' : 'Submit'}
            </button>
          )}
        </footer>
      </form>
    </div>
  )
}

function RunnerField({
  field,
  value,
  onChange,
  index,
  total,
}: {
  field: FormField
  value: AnswerValue | undefined
  onChange: (value: AnswerValue) => void
  index?: number
  total?: number
}) {
  const stringValue = Array.isArray(value) ? '' : value === undefined ? '' : String(value)
  const selectedOptions = Array.isArray(value) ? value : []

  function toggleOption(option: string) {
    const exists = selectedOptions.includes(option)
    onChange(
      exists
        ? selectedOptions.filter((item) => item !== option)
        : [...selectedOptions, option],
    )
  }

  return (
    <section className="runner-field">
      {index && total ? (
        <p className="runner-count">
          {index} of {total}
        </p>
      ) : null}
      <label>
        <span className="runner-label">
          {field.label}
          {field.required ? <strong>*</strong> : null}
        </span>
        {field.type === 'long_text' ? (
          <textarea
            rows={6}
            value={stringValue}
            placeholder={field.placeholder}
            aria-required={field.required}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : null}
        {field.type === 'short_text' ||
        field.type === 'email' ||
        field.type === 'number' ||
        field.type === 'date' ? (
          <input
            type={
              field.type === 'short_text'
                ? 'text'
                : field.type === 'number'
                  ? 'number'
                  : field.type
            }
            value={stringValue}
            placeholder={field.placeholder}
            aria-required={field.required}
            onChange={(event) =>
              onChange(
                field.type === 'number'
                  ? Number(event.target.value)
                  : event.target.value,
              )
            }
          />
        ) : null}
        {field.type === 'dropdown' ? (
          <select
            value={stringValue}
            aria-required={field.required}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="">Select an answer</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : null}
      </label>

      {field.type === 'single_choice' ? (
        <div className="option-grid" role="group" aria-label={field.label}>
          {field.options.map((option) => (
            <button
              type="button"
              key={option}
              className={`option-button ${value === option ? 'selected' : ''}`}
              aria-pressed={value === option}
              onClick={() => onChange(option)}
            >
              {value === option ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {field.type === 'multi_choice' ? (
        <div className="option-grid" role="group" aria-label={field.label}>
          {field.options.map((option) => (
            <button
              type="button"
              key={option}
              className={`option-button ${selectedOptions.includes(option) ? 'selected' : ''}`}
              aria-pressed={selectedOptions.includes(option)}
              onClick={() => toggleOption(option)}
            >
              {selectedOptions.includes(option) ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Circle size={16} aria-hidden="true" />
              )}
              {option}
            </button>
          ))}
        </div>
      ) : null}

      {field.type === 'rating' ? (
        <div className="rating-row" role="group" aria-label={field.label}>
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              type="button"
              key={score}
              className={Number(value) === score ? 'selected' : ''}
              aria-label={`${score} out of 5`}
              aria-pressed={Number(value) === score}
              onClick={() => onChange(score)}
            >
              {score}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function StatusScreen({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string
  body: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <main className="status-screen">
      <div className="brand-mark large">
        <FileText size={26} aria-hidden="true" />
      </div>
      <h1>{title}</h1>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <button type="button" className="button primary" onClick={onAction}>
          <Plus size={16} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : null}
    </main>
  )
}

export default App

function runnerBackgroundMoodClass(mood: RunnerBackgroundMood | undefined) {
  return `mood-${mood ?? defaultRunnerBackgroundMood}`
}

function runnerBackgroundMoodLabel(mood: RunnerBackgroundMood | undefined) {
  return (
    runnerBackgroundMoods.find((item) => item.id === mood)?.label ??
    runnerBackgroundMoods.find((item) => item.id === defaultRunnerBackgroundMood)?.label ??
    'Guided path'
  )
}

function responseHasEmptyAnswer(response: ResponseRecord, fields: FormField[]) {
  return fields.some((field) => {
    const value = response.answers[field.id]

    if (Array.isArray(value)) {
      return value.length === 0
    }

    return String(value ?? '').trim() === ''
  })
}

function makeDemoResponses(fields: FormField[]): Array<Record<string, AnswerValue>> {
  return [0, 1, 2].map((sampleIndex) => {
    const answers: Record<string, AnswerValue> = {}

    for (const field of fields) {
      answers[field.id] = demoAnswerForField(field, sampleIndex)
    }

    return answers
  })
}

function demoAnswerForField(field: FormField, sampleIndex: number): AnswerValue {
  const shortText = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson']
  const emails = ['ada@example.test', 'grace@example.test', 'katherine@example.test']
  const longText = [
    'The guided launch path made the next step obvious.',
    'Templates helped us get to a useful draft quickly.',
    'The response workflow is easy to scan and export.',
  ]
  const improvements = [
    'Add a few more handoff states for teams.',
    'Make first-time sharing feel even more guided.',
    'Add a compact report view for response summaries.',
  ]

  if (field.type === 'email') {
    return emails[sampleIndex % emails.length]
  }

  if (field.type === 'number') {
    return sampleIndex + 1
  }

  if (field.type === 'rating') {
    return [5, 4, 5][sampleIndex % 3]
  }

  if (field.type === 'date') {
    return `2026-06-${String(20 + sampleIndex).padStart(2, '0')}`
  }

  if (field.type === 'multi_choice') {
    return field.options.length > 0
      ? field.options.slice(0, Math.min(2, field.options.length))
      : ['Sample choice']
  }

  if (isOptionField(field.type)) {
    if (field.label.toLowerCase().includes('follow up')) {
      return sampleIndex === 1 ? 'No' : 'Yes'
    }
    return field.options[sampleIndex % field.options.length] ?? 'Sample choice'
  }

  if (field.type === 'long_text') {
    return field.label.toLowerCase().includes('improve')
      ? improvements[sampleIndex % improvements.length]
      : longText[sampleIndex % longText.length]
  }

  return shortText[sampleIndex % shortText.length]
}

function slugifyFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'the-foundry'
  )
}

function responseCsvValue(value: AnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value.join('; ')
  }

  return value ?? ''
}

function csvCell(value: string | number) {
  const text = String(value)
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function downloadTextFile(contents: string, type: string, fileName: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
