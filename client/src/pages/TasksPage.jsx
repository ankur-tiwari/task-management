import { useCallback, useEffect, useState } from 'react';
import { taskService, userService } from '../api/services';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/Alert';
import Button from '../components/Button';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import TaskForm from '../components/TaskForm';
import TaskItem from '../components/TaskItem';
import TaskFilters from '../components/TaskFilters';
import Pagination from '../components/Pagination';

const PAGE_SIZE = 10;

function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [meta, setMeta] = useState({ total: 0, total_pages: 1 });
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);        // null | { task?: Task }
  const [deleting, setDeleting] = useState(null);    // null | Task
  const [deleteState, setDeleteState] = useState({ loading: false, error: '' });
  const q = useDebounced(search.trim());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await taskService.list({ page, limit: PAGE_SIZE, q, status });
      setTasks(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, q, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { userService.list().then((r) => setUsers(r.data)).catch(() => {}); }, []);

  const save = async (payload) => {
    if (editor.task) {
      const isCreator = editor.task.created_by === user.id;
      await (isCreator ? taskService.replace(editor.task.id, payload) : taskService.patch(editor.task.id, payload));
    } else {
      await taskService.create(payload);
    }
    setEditor(null);
    await load();
  };

  const confirmDelete = async () => {
    setDeleteState({ loading: true, error: '' });
    try {
      await taskService.remove(deleting.id);
      setDeleting(null);
      setDeleteState({ loading: false, error: '' });
      // Step back a page if we just removed the last item on it.
      if (tasks.length === 1 && page > 1) setPage(page - 1); else await load();
    } catch (err) {
      setDeleteState({ loading: false, error: err.message });
    }
  };

  const changeFilter = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <section>
      <div className="page-header">
        <h1>My tasks</h1>
        <Button onClick={() => setEditor({})}>+ New task</Button>
      </div>

      <TaskFilters search={search} status={status} onSearch={changeFilter(setSearch)} onStatus={changeFilter(setStatus)} />
      <Alert>{error}</Alert>

      {loading && tasks.length === 0 ? (
        <p className="center-note">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <div className="card empty">No tasks found. {q || status ? 'Try changing your filters.' : 'Create your first task!'}</div>
      ) : (
        <ul className={`task-list${loading ? ' is-loading' : ''}`}>
          {tasks.map((t) => (
            <TaskItem key={t.id} task={t} currentUserId={user.id} onEdit={(task) => setEditor({ task })}
              onDelete={(task) => { setDeleteState({ loading: false, error: '' }); setDeleting(task); }} />
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={meta.total_pages} total={meta.total} onChange={setPage} />

      {editor && (
        <Modal title={editor.task ? 'Edit task' : 'New task'} onClose={() => setEditor(null)}>
          <TaskForm task={editor.task} users={users} statusOnly={Boolean(editor.task) && editor.task.created_by !== user.id}
            onSubmit={save} onCancel={() => setEditor(null)} />
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog title="Delete task" message={`Delete “${deleting.task_name}”? This cannot be undone.`}
          loading={deleteState.loading} error={deleteState.error} onConfirm={confirmDelete} onCancel={() => setDeleting(null)} />
      )}
    </section>
  );
}
