import { z } from 'zod';

// These rules intentionally mirror server/src/validators/*. The server is the
// source of truth; the client copy exists for fast, friendly feedback.

export const TASK_STATUSES = ['Pending', 'In-progress', 'Completed', 'Blocked'];

const nameField = (label) =>
  z.string().trim()
    .min(1, `${label} is required.`)
    .max(50, `${label} must be at most 50 characters.`)
    .regex(/^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u, `${label} contains invalid characters.`);

const emailField = z.string().trim().toLowerCase()
  .min(1, 'Email is required.')
  .max(254, 'Email is too long.')
  .pipe(z.email('Enter a valid email address.'));

const passwordRules = z.string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/\d/, 'Password must contain a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol.');

export const registerSchema = z.object({
  first_name: nameField('First name'),
  last_name: nameField('Last name'),
  email: emailField,
  password: passwordRules,
  confirm_password: z.string().min(1, 'Please confirm your password.'),
}).refine((v) => v.password === v.confirm_password, {
  path: ['confirm_password'],
  message: 'Passwords do not match.',
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required.').max(128, 'Password is too long.'),
});

export const totpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
});

export const disableMfaSchema = totpSchema.extend({
  password: z.string().min(1, 'Password is required.').max(128, 'Password is too long.'),
});

export const taskSchema = z.object({
  task_name: z.string().trim().min(1, 'Task name is required.').max(120, 'Task name must be at most 120 characters.'),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters.'),
  due_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be a valid date.')
    .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Due date must be a valid date.')
    .nullable(),
  assigned_to: z.uuid('Choose a valid assignee.').nullable(),
  status: z.enum(TASK_STATUSES, { error: 'Choose a valid status.' }),
});

/** Returns { data } on success or { errors: { field: message } } on failure. */
export function validate(schema, values) {
  const result = schema.safeParse(values);
  if (result.success) return { data: result.data, errors: {} };
  const errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] ?? 'form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { data: null, errors };
}
