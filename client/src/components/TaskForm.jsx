import { useState } from 'react';
import { TextField, TextAreaField, SelectField } from './Field';
import Button from './Button';
import Alert from './Alert';
import { useForm } from '../hooks/useForm';
import { TASK_STATUSES, taskSchema } from '../validation/schemas';

const STATUS_OPTIONS = TASK_STATUSES.map((s) => ({ value: s, label: s }));

const toFormValues = (task) => ({
  task_name: task?.task_name ?? '',
  description: task?.description ?? '',
  due_date: task?.due_date ?? '',
  assigned_to: task?.assigned_to ?? '',
  status: task?.status ?? 'Pending',
});

/**
 * Create / edit form. When `statusOnly` is set (assignee who is not the creator)
 * every field except status is read-only — the API enforces the same rule.
 */
export default function TaskForm({ task, users, statusOnly = false, onSubmit, onCancel }) {
  const { values, errors, handleChange, validateAll, setServerErrors } = useForm(toFormValues(task), taskSchema);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const candidate = { ...values, due_date: values.due_date || null, assigned_to: values.assigned_to || null };
    const data = validateAll(candidate);
    if (!data) return;
    setSaving(true);
    try {
      await onSubmit(statusOnly ? { status: data.status } : data);
    } catch (err) {
      setServerErrors(err);
    } finally {
      setSaving(false);
    }
  };

  const userOptions = users.map((u) => ({ value: u.id, label: `${u.first_name} ${u.last_name}` }));

  return (
    <form onSubmit={submit} noValidate>
      <Alert>{errors.form}</Alert>
      <TextField label="Task name" name="task_name" value={values.task_name} onChange={handleChange}
        error={errors.task_name} maxLength={120} disabled={statusOnly} autoFocus={!statusOnly} required />
      <TextAreaField label="Description" name="description" value={values.description} onChange={handleChange}
        error={errors.description} maxLength={2000} disabled={statusOnly} />
      <div className="grid-2">
        <TextField label="Due date" name="due_date" type="date" value={values.due_date} onChange={handleChange}
          error={errors.due_date} disabled={statusOnly} />
        <SelectField label="Status" name="status" value={values.status} onChange={handleChange}
          error={errors.status} options={STATUS_OPTIONS} />
      </div>
      <SelectField label="Assign to" name="assigned_to" value={values.assigned_to} onChange={handleChange}
        error={errors.assigned_to} options={userOptions} placeholder="Unassigned" disabled={statusOnly} />
      <div className="modal-actions">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{task ? 'Save changes' : 'Create task'}</Button>
      </div>
    </form>
  );
}
