import type {
  AppMeta,
  FormRecord,
  ResponseRecord,
  SubmitPayload,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    let message = `Request failed with ${response.status}`
    try {
      const body = (await response.json()) as { error?: string }
      message = body.error ?? message
    } catch {
      // Keep the status based message when a non-JSON error is returned.
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export const api = {
  getMeta: () => request<AppMeta>('/api/meta'),
  listForms: () => request<FormRecord[]>('/api/forms'),
  createForm: () => request<FormRecord>('/api/forms', { method: 'POST' }),
  importFormDefinition: (payload: unknown) =>
    request<FormRecord>('/api/forms/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getForm: (id: string) => request<FormRecord>(`/api/forms/${id}`),
  exportDefinitionUrl: (id: string) => `/api/forms/${id}/definition.json`,
  saveForm: (id: string, form: FormRecord) =>
    request<FormRecord>(`/api/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(form),
    }),
  listResponses: (id: string) =>
    request<ResponseRecord[]>(`/api/forms/${id}/responses`),
  deleteResponses: (id: string, responseIds: string[]) =>
    request<{ deleted: number }>(`/api/forms/${id}/responses`, {
      method: 'DELETE',
      body: JSON.stringify({ responseIds }),
    }),
  submitResponse: (id: string, payload: SubmitPayload) =>
    request<{ ok: true; responseId: string }>(`/api/forms/${id}/responses`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  exportCsvUrl: (id: string) => `/api/forms/${id}/export.csv`,
}
