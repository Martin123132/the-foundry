import type { AnswerValue, FieldType, FormField, FormMode, FormRecord, ResponseRecord } from './types';

export type GuideAction = 'save' | 'add-question' | 'publish' | 'preview' | 'export';

export interface GuideStep {
  id: 'shape' | 'publish' | 'share' | 'collect' | 'export';
  label: string;
  done: boolean;
}

type TemplateField = Pick<FormField, 'type' | 'label' | 'placeholder' | 'required'> & {
  options?: string[];
};

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  title: string;
  formDescription: string;
  mode: FormMode;
  accentColor: string;
  successMessage: string;
  fields: TemplateField[];
}

export const fieldTypes: Array<{
  type: FieldType;
  label: string;
  description: string;
}> = [
  { type: 'short_text', label: 'Short text', description: 'One line answer' },
  { type: 'long_text', label: 'Long text', description: 'Paragraph answer' },
  { type: 'email', label: 'Email', description: 'Validated contact' },
  { type: 'number', label: 'Number', description: 'Numeric input' },
  { type: 'single_choice', label: 'Single choice', description: 'Pick one' },
  { type: 'multi_choice', label: 'Checkboxes', description: 'Pick many' },
  { type: 'dropdown', label: 'Dropdown', description: 'Compact choice' },
  { type: 'rating', label: 'Rating', description: '1 to 5 score' },
  { type: 'date', label: 'Date', description: 'Calendar value' },
];

export const defaultOptions = ['Option one', 'Option two', 'Option three'];

export const formTemplates: FormTemplate[] = [
  {
    id: 'beta-feedback',
    name: 'Beta feedback',
    description: 'Product signal after a launch or test group.',
    title: 'Launch feedback',
    formDescription: 'A compact form for collecting product feedback after a beta launch.',
    mode: 'flow',
    accentColor: '#087f7a',
    successMessage: 'Thanks. Your feedback is in the vault.',
    fields: [
      {
        type: 'email',
        label: 'What email should we use for follow-up?',
        placeholder: 'you@example.com',
        required: true,
      },
      {
        type: 'single_choice',
        label: 'How would you rate the first impression?',
        placeholder: '',
        required: true,
        options: ['Strong', 'Useful but rough', 'Confusing', 'Not for me'],
      },
      {
        type: 'long_text',
        label: 'What should we improve next?',
        placeholder: 'Tell us what would make this more useful.',
        required: true,
      },
    ],
  },
  {
    id: 'client-intake',
    name: 'Client intake',
    description: 'Scope a request before a call or proposal.',
    title: 'Project intake',
    formDescription: 'A focused intake path for qualifying new client work.',
    mode: 'flow',
    accentColor: '#315c85',
    successMessage: 'Thanks. We have enough to map the next step.',
    fields: [
      {
        type: 'short_text',
        label: 'What should we call this project?',
        placeholder: 'Project or company name',
        required: true,
      },
      {
        type: 'dropdown',
        label: 'What kind of help do you need?',
        placeholder: '',
        required: true,
        options: ['Website', 'Internal tool', 'Automation', 'Consulting', 'Not sure yet'],
      },
      {
        type: 'long_text',
        label: 'What outcome are you trying to reach?',
        placeholder: 'Describe the goal in a few sentences.',
        required: true,
      },
      {
        type: 'single_choice',
        label: 'What timeline are you working toward?',
        placeholder: '',
        required: true,
        options: ['This week', 'This month', 'This quarter', 'Flexible'],
      },
      {
        type: 'email',
        label: 'Where should we reply?',
        placeholder: 'name@example.com',
        required: true,
      },
    ],
  },
  {
    id: 'event-rsvp',
    name: 'Event RSVP',
    description: 'Gather attendance, needs, and guest counts.',
    title: 'Event RSVP',
    formDescription: 'A simple RSVP form for planning attendance and logistics.',
    mode: 'classic',
    accentColor: '#8f4a38',
    successMessage: 'You are on the list. See you there.',
    fields: [
      {
        type: 'short_text',
        label: 'What is your name?',
        placeholder: 'Full name',
        required: true,
      },
      {
        type: 'email',
        label: 'What email should we send updates to?',
        placeholder: 'you@example.com',
        required: true,
      },
      {
        type: 'single_choice',
        label: 'Will you attend?',
        placeholder: '',
        required: true,
        options: ['Yes', 'No', 'Maybe'],
      },
      {
        type: 'number',
        label: 'How many guests are coming with you?',
        placeholder: '0',
        required: false,
      },
      {
        type: 'multi_choice',
        label: 'Any requirements we should plan for?',
        placeholder: '',
        required: false,
        options: ['Vegetarian', 'Vegan', 'Gluten-free', 'Step-free access', 'Quiet space'],
      },
    ],
  },
];

export function newId(prefix: string) {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}_${id}`;
}

export function createField(type: FieldType, position: number): FormField {
  const meta = fieldTypes.find((item) => item.type === type);
  const needsOptions =
    type === 'single_choice' || type === 'multi_choice' || type === 'dropdown';

  return {
    id: newId('field'),
    type,
    label: meta?.label ?? 'Question',
    placeholder: type === 'long_text' ? 'Write a thoughtful answer' : 'Type here',
    required: true,
    options: needsOptions ? [...defaultOptions] : [],
    position,
  };
}

export function copyField(field: FormField, position: number): FormField {
  return {
    ...field,
    id: newId('field'),
    label: `${field.label} copy`,
    options: field.options ? [...field.options] : [],
    position,
  };
}

export function applyTemplate(form: FormRecord, template: FormTemplate): FormRecord {
  return {
    ...form,
    title: template.title,
    description: template.formDescription,
    mode: template.mode,
    accentColor: template.accentColor,
    successMessage: template.successMessage,
    fields: template.fields.map((field, index) => ({
      id: newId('field'),
      type: field.type,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      options: field.options ? [...field.options] : [],
      position: index,
    })),
  };
}

export function sortFields(fields: FormField[]) {
  return [...fields].sort((a, b) => a.position - b.position);
}

export function fieldTypeLabel(type: FieldType) {
  return fieldTypes.find((item) => item.type === type)?.label ?? type;
}

export function answerLabel(value: AnswerValue | undefined): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value === undefined || value === '') {
    return 'No answer';
  }

  return String(value);
}

export function isOptionField(type: FieldType) {
  return type === 'single_choice' || type === 'multi_choice' || type === 'dropdown';
}

export function makeGuideState(
  form: FormRecord,
  fields: FormField[],
  responses: ResponseRecord[],
  dirty: boolean,
) {
  const shaped = form.title.trim().length > 0 && fields.length > 0;
  const published = form.status === 'published';
  const collected = responses.length > 0;
  const steps: GuideStep[] = [
    { id: 'shape', label: 'Shape', done: shaped },
    { id: 'publish', label: 'Publish', done: published },
    { id: 'share', label: 'Share', done: published },
    { id: 'collect', label: 'Collect', done: collected },
    { id: 'export', label: 'Export', done: collected },
  ];

  if (dirty) {
    return {
      steps,
      nextAction: 'save' as GuideAction,
      nextLabel: 'Save changes',
      nextTitle: 'Autosave is watching',
    };
  }

  if (!shaped) {
    return {
      steps,
      nextAction: 'add-question' as GuideAction,
      nextLabel: 'Add question',
      nextTitle: 'Shape the form',
    };
  }

  if (!published) {
    return {
      steps,
      nextAction: 'publish' as GuideAction,
      nextLabel: 'Publish form',
      nextTitle: 'Open the gate',
    };
  }

  if (!collected) {
    return {
      steps,
      nextAction: 'preview' as GuideAction,
      nextLabel: 'Run preview',
      nextTitle: 'Walk the path',
    };
  }

  return {
    steps,
    nextAction: 'export' as GuideAction,
    nextLabel: 'Export CSV',
    nextTitle: 'Package the signal',
  };
}
