'use strict';
const { z } = require('zod');

const STATUSES = ['Pending', 'In-progress', 'Completed', 'Blocked'];

const dueDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format.')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
  }, 'Due date is not a valid calendar date.');

const fields = {
  task_name: z.string({ error: 'Task name is required.' })
    .trim()
    .min(1, 'Task name is required.')
    .max(120, 'Task name must be at most 120 characters.'),
  description: z.string().trim().max(2000, 'Description must be at most 2000 characters.'),
  due_date: dueDate.nullable(),
  assigned_to: z.uuid('Assignee must be a valid user id.').nullable(),
  status: z.enum(STATUSES, { error: `Status must be one of: ${STATUSES.join(', ')}.` }),
};

// Full representation (POST / PUT). Optional fields get safe defaults.
const createTaskSchema = z.strictObject({
  task_name: fields.task_name,
  description: fields.description.default(''),
  due_date: fields.due_date.default(null),
  assigned_to: fields.assigned_to.default(null),
  status: fields.status.default('Pending'),
});

// PATCH: any subset, at least one field.
const patchTaskSchema = z.strictObject({
  task_name: fields.task_name.optional(),
  description: fields.description.optional(),
  due_date: fields.due_date.optional(),
  assigned_to: fields.assigned_to.optional(),
  status: fields.status.optional(),
}).refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update.');

const idParamSchema = z.strictObject({ id: z.uuid('Invalid id.') });

const listQuerySchema = z.strictObject({
  status: fields.status.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

module.exports = { STATUSES, createTaskSchema, patchTaskSchema, idParamSchema, listQuerySchema };
