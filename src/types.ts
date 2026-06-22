export type FieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'number'
  | 'single_choice'
  | 'multi_choice'
  | 'dropdown'
  | 'rating'
  | 'date'

export type FormStatus = 'draft' | 'published'
export type FormMode = 'flow' | 'classic'
export type AnswerValue = string | string[] | number

export interface FormField {
  id: string
  type: FieldType
  label: string
  placeholder: string
  required: boolean
  options: string[]
  position: number
}

export interface FormRecord {
  id: string
  title: string
  description: string
  status: FormStatus
  mode: FormMode
  accentColor: string
  backgroundColor: string
  textColor: string
  successMessage: string
  webhookUrl: string
  fields: FormField[]
  responseCount: number
  createdAt: string
  updatedAt: string
}

export interface ResponseRecord {
  id: string
  formId: string
  answers: Record<string, AnswerValue>
  createdAt: string
}

export interface SubmitPayload {
  answers: Record<string, AnswerValue>
  honeypot?: string
}

export interface AppMeta {
  storageMode: 'sqlite'
  dataDir: string
  databaseFile: string
  environment: {
    host: string
    port: number
    dataDirVariable: string
  }
  defaults: {
    newFormStatus: FormStatus
    mode: FormMode
    accentColor: string
    backgroundColor: string
    textColor: string
  }
}
