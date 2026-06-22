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
  ResponseRecord,
} from './types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type ResponseFilter = 'all' | 'complete' | 'needs_answer'

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
  const shareUrl = form ? `${window.location.origin}/f/${form.id}` : ''
  const embedCode = form
    ? `<iframe src="${shareUrl}" title="${form.title}" style="width:100%;height:720px;border:0;border-radius:8px"></iframe>`
    : ''
  const guide = useMemo(
    () => (form ? makeGuideState(form, orderedFields, responses, dirty) : null),
    [dirty, form, orderedFields, responses],
  )
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

  async function refreshResponses() {
    if (!form) {
      return
    }
    const nextResponses = await api.listResponses(form.id)
    setResponses(nextResponses)
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
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${slugifyFileName(form.title)}-responses.json`
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
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
      <StatusScreen
        title="No forms yet"
        body="Create the first form to start collecting responses."
        actionLabel="Create form"
        onAction={createNewForm}
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
            <p className="brand-subtitle">Open-source forms and response workflows</p>
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
              nextTitle={guide.nextTitle}
              nextLabel={guide.nextLabel}
              nextAction={guide.nextAction}
              onAction={runGuideAction}
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
                <h2>{responses.length} submissions</h2>
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
                <a className="button ghost" href={api.exportCsvUrl(form.id)}>
                  <Download size={16} aria-hidden="true" />
                  CSV
                </a>
                <button
                  type="button"
                  className="button ghost"
                  onClick={exportVisibleResponsesJson}
                  disabled={responses.length === 0}
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

            <div className="response-table-wrap">
              <table className="response-table">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Answers</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.length === 0 ? (
                    <tr>
                      <td colSpan={2}>No responses yet</td>
                    </tr>
                  ) : filteredResponses.length === 0 ? (
                    <tr>
                      <td colSpan={2}>No responses match this search or filter</td>
                    </tr>
                  ) : (
                    filteredResponses.map((response) => (
                      <tr key={response.id}>
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
  nextTitle,
  nextLabel,
  nextAction,
  onAction,
}: {
  steps: GuideStep[]
  nextTitle: string
  nextLabel: string
  nextAction: GuideAction
  onAction: (action: GuideAction) => Promise<void>
}) {
  const completeCount = steps.filter((step) => step.done).length

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
      <ol className="guide-steps" aria-label="Launch path progress">
        {steps.map((step, index) => (
          <li key={step.id} className={step.done ? 'done' : ''}>
            <GuideStepIcon id={step.id} done={step.done} />
            <span>{step.label}</span>
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
        Moves questions, copy, mode, and colors. Responses and webhook URLs stay out
        of the export.
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
    if (!validateAll()) {
      setError('Please answer all required questions.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await api.submitResponse(formId, { answers, honeypot })
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

  if (form.status !== 'published') {
    return (
      <StatusScreen
        title="Submissions are closed"
        body="This form is still a draft. Ask the owner to publish it before sharing this link."
      />
    )
  }

  if (submitted) {
    return (
      <div
        className="public-shell"
        style={{
          background: form.backgroundColor,
          color: form.textColor,
        }}
      >
        <section className="success-state">
          <CheckCircle2 size={42} color={form.accentColor} aria-hidden="true" />
          <h1>{form.successMessage}</h1>
          <p>{form.title}</p>
          <a className="button primary" href="/">
            Back to studio
          </a>
        </section>
      </div>
    )
  }

  return (
    <div
      className="public-shell"
      style={{
        background: form.backgroundColor,
        color: form.textColor,
        ['--runner-accent' as string]: form.accentColor,
      }}
    >
      <form className="runner" onSubmit={(event) => void submit(event)}>
        <header className="runner-header">
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

        {form.mode === 'classic' ? (
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
                disabled={step === 0}
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
                <button type="submit" className="button primary" disabled={submitting}>
                  <Send size={16} aria-hidden="true" />
                  {submitting ? 'Sending' : 'Submit'}
                </button>
              )}
            </>
          ) : (
            <button type="submit" className="button primary" disabled={submitting}>
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

function responseHasEmptyAnswer(response: ResponseRecord, fields: FormField[]) {
  return fields.some((field) => {
    const value = response.answers[field.id]

    if (Array.isArray(value)) {
      return value.length === 0
    }

    return String(value ?? '').trim() === ''
  })
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
