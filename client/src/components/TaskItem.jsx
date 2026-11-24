import StatusBadge from './StatusBadge';
import Button from './Button';

const fmtDate = (d) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', dateStyle: 'medium' }) : '—');
const fmtDateTime = (s) => new Date(s).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const isOverdue = (task) =>
  Boolean(task.due_date) && task.status !== 'Completed' && task.due_date < new Date().toISOString().slice(0, 10);

export default function TaskItem({ task, currentUserId, onEdit, onDelete }) {
  const isCreator = task.created_by === currentUserId;
  return (
    <li className="task-card">
      <div className="task-main">
        <h3>{task.task_name}</h3>
        {task.description && <p className="task-desc">{task.description}</p>}
        <dl className="task-meta">
          <div><dt>Due</dt><dd className={isOverdue(task) ? 'overdue' : ''}>{fmtDate(task.due_date)}{isOverdue(task) && ' (overdue)'}</dd></div>
          <div><dt>Assigned to</dt><dd>{task.assigned_to_name ?? 'Unassigned'}</dd></div>
          <div><dt>Created by</dt><dd>{task.created_by_name}</dd></div>
          <div><dt>Created</dt><dd>{fmtDateTime(task.created_at)}</dd></div>
          <div><dt>Updated</dt><dd>{fmtDateTime(task.updated_at)}</dd></div>
        </dl>
      </div>
      <div className="task-side">
        <StatusBadge status={task.status} />
        <div className="task-actions">
          <Button variant="secondary" onClick={() => onEdit(task)}>{isCreator ? 'Edit' : 'Update status'}</Button>
          {isCreator && <Button variant="danger" onClick={() => onDelete(task)}>Delete</Button>}
        </div>
      </div>
    </li>
  );
}
