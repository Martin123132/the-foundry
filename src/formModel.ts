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
  closedMessage?: string;
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
    id: 'contact-form',
    name: 'Contact',
    description: 'Simple inbound messages with reply details.',
    title: 'Contact us',
    formDescription: 'A focused way for visitors to send a message and contact details.',
    mode: 'flow',
    accentColor: '#087f7a',
    successMessage: 'Thanks. Your message has been received.',
    fields: [
      {
        type: 'short_text',
        label: 'What is your name?',
        placeholder: 'Full name',
        required: true,
      },
      {
        type: 'email',
        label: 'What email should we use to reply?',
        placeholder: 'you@example.com',
        required: true,
      },
      {
        type: 'long_text',
        label: 'How can we help?',
        placeholder: 'Write your message here.',
        required: true,
      },
      {
        type: 'dropdown',
        label: 'What is this about?',
        placeholder: '',
        required: true,
        options: ['General question', 'Support', 'Partnership', 'Press', 'Other'],
      },
    ],
  },
  {
    id: 'event-registration',
    name: 'Event registration',
    description: 'Attendance, guest count, and access needs.',
    title: 'Event registration',
    formDescription: 'Collect attendee details and planning requirements before an event.',
    mode: 'flow',
    accentColor: '#8f4a38',
    successMessage: 'You are registered. We will send details soon.',
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
      {
        type: 'single_choice',
        label: 'Can we contact you about event updates?',
        placeholder: '',
        required: true,
        options: ['Yes', 'No'],
      },
    ],
  },
  {
    id: 'customer-feedback',
    name: 'Customer feedback',
    description: 'Product signal after a launch or support touchpoint.',
    title: 'Customer feedback',
    formDescription: 'A compact form for collecting product feedback and next-step signals.',
    mode: 'flow',
    accentColor: '#087f7a',
    successMessage: 'Thanks. Your feedback is in the vault.',
    fields: [
      {
        type: 'single_choice',
        label: 'How would you rate the experience?',
        placeholder: '',
        required: true,
        options: ['Excellent', 'Good', 'Okay', 'Poor'],
      },
      {
        type: 'long_text',
        label: 'What worked well?',
        placeholder: 'Tell us what felt useful.',
        required: false,
      },
      {
        type: 'long_text',
        label: 'What should we improve next?',
        placeholder: 'Tell us what would make this better.',
        required: true,
      },
      {
        type: 'single_choice',
        label: 'May we follow up?',
        placeholder: '',
        required: true,
        options: ['Yes', 'No'],
      },
    ],
  },
  {
    id: 'bug-report',
    name: 'Bug report',
    description: 'Reproduction details for broken product flows.',
    title: 'Bug report',
    formDescription: 'Capture reproducible bug reports with severity and environment context.',
    mode: 'classic',
    accentColor: '#b64232',
    successMessage: 'Thanks. The report is ready for triage.',
    fields: [
      {
        type: 'short_text',
        label: 'What broke?',
        placeholder: 'Short summary',
        required: true,
      },
      {
        type: 'long_text',
        label: 'How can we reproduce it?',
        placeholder: 'List the exact steps you took.',
        required: true,
      },
      {
        type: 'single_choice',
        label: 'How severe is it?',
        placeholder: '',
        required: true,
        options: ['Blocking', 'High', 'Medium', 'Low'],
      },
      {
        type: 'short_text',
        label: 'What browser, device, or environment were you using?',
        placeholder: 'Chrome on Windows, iPhone Safari, etc.',
        required: false,
      },
      {
        type: 'email',
        label: 'Where should we follow up?',
        placeholder: 'you@example.com',
        required: false,
      },
    ],
  },
  {
    id: 'lead-capture',
    name: 'Lead capture',
    description: 'Qualify interest before a sales or service call.',
    title: 'Lead capture',
    formDescription: 'Collect contact details, intent, and timing from potential customers.',
    mode: 'flow',
    accentColor: '#315c85',
    successMessage: 'Thanks. We will follow up with the next step.',
    fields: [
      {
        type: 'short_text',
        label: 'What is your company or project name?',
        placeholder: 'Company or project',
        required: true,
      },
      {
        type: 'email',
        label: 'Where should we reply?',
        placeholder: 'name@example.com',
        required: true,
      },
      {
        type: 'multi_choice',
        label: 'What are you interested in?',
        placeholder: '',
        required: true,
        options: ['Product demo', 'Pricing', 'Implementation', 'Partnership', 'Not sure yet'],
      },
      {
        type: 'single_choice',
        label: 'When are you hoping to start?',
        placeholder: '',
        required: true,
        options: ['This week', 'This month', 'This quarter', 'Later'],
      },
      {
        type: 'long_text',
        label: 'What outcome are you trying to reach?',
        placeholder: 'Share the goal in a few sentences.',
        required: false,
      },
    ],
  },
  {
    id: 'internal-request',
    name: 'Internal request',
    description: 'Route team asks with priority and context.',
    title: 'Internal request',
    formDescription: 'Gather structured internal requests before assigning the work.',
    mode: 'classic',
    accentColor: '#5d5a88',
    successMessage: 'Request received. The team can triage it from here.',
    fields: [
      {
        type: 'short_text',
        label: 'What do you need?',
        placeholder: 'Short request title',
        required: true,
      },
      {
        type: 'dropdown',
        label: 'Which team should handle it?',
        placeholder: '',
        required: true,
        options: ['Operations', 'Engineering', 'Design', 'Finance', 'People', 'Other'],
      },
      {
        type: 'single_choice',
        label: 'How urgent is this?',
        placeholder: '',
        required: true,
        options: ['Today', 'This week', 'This month', 'No deadline'],
      },
      {
        type: 'long_text',
        label: 'What context should the owner know?',
        placeholder: 'Add links, constraints, or background.',
        required: true,
      },
      {
        type: 'email',
        label: 'Who should receive updates?',
        placeholder: 'teammate@example.com',
        required: false,
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
    closedMessage:
      template.closedMessage ?? 'This form is not accepting responses right now.',
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
