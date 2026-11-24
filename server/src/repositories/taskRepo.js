'use strict';
const crypto = require('node:crypto');

const SELECT = `
  SELECT t.id, t.task_name, t.description, t.due_date, t.status,
         t.created_by, t.assigned_to, t.created_at, t.updated_at,
         cu.first_name || ' ' || cu.last_name AS created_by_name,
         au.first_name || ' ' || au.last_name AS assigned_to_name
  FROM tasks t
  JOIN users cu ON cu.id = t.created_by
  LEFT JOIN users au ON au.id = t.assigned_to`;

// Row-level access: a user only ever sees tasks they created or are assigned to.
// SQLite has no native RLS, so this predicate is applied in EVERY query below.
const VISIBLE = '(t.created_by = @userId OR t.assigned_to = @userId)';

const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function createTaskRepo(db) {
  const now = () => new Date().toISOString();

  const insert = db.prepare(`INSERT INTO tasks (id, task_name, description, due_date, status, created_by, assigned_to)
                             VALUES (@id, @task_name, @description, @due_date, @status, @created_by, @assigned_to)`);
  const byIdVisible = db.prepare(`${SELECT} WHERE t.id = @id AND ${VISIBLE}`);
  const remove = db.prepare('DELETE FROM tasks WHERE id = @id AND created_by = @userId');

  const UPDATABLE = ['task_name', 'description', 'due_date', 'assigned_to', 'status'];

  return {
    create(userId, data) {
      const id = crypto.randomUUID();
      insert.run({ id, created_by: userId, ...data });
      return byIdVisible.get({ id, userId });
    },

    findVisible: (id, userId) => byIdVisible.get({ id, userId }),

    list(userId, { status, q, page, limit }) {
      const where = [VISIBLE];
      const params = { userId, limit, offset: (page - 1) * limit };
      if (status) { where.push('t.status = @status'); params.status = status; }
      if (q) { where.push("(t.task_name LIKE @q ESCAPE '\\' OR t.description LIKE @q ESCAPE '\\')"); params.q = `%${escapeLike(q)}%`; }
      const clause = where.join(' AND ');
      const total = db.prepare(`SELECT COUNT(*) AS n FROM tasks t WHERE ${clause}`).get(params).n;
      const items = db.prepare(`${SELECT} WHERE ${clause} ORDER BY t.created_at DESC, t.id LIMIT @limit OFFSET @offset`).all(params);
      return { items, total };
    },

    // Column names come from a fixed allow-list, values are bound parameters.
    update(id, userId, changes, { creatorOnly }) {
      const keys = Object.keys(changes).filter((k) => UPDATABLE.includes(k));
      if (keys.length === 0) return byIdVisible.get({ id, userId });
      const sets = keys.map((k) => `${k} = @${k}`).join(', ');
      const guard = creatorOnly ? 'created_by = @userId' : '(created_by = @userId OR assigned_to = @userId)';
      db.prepare(`UPDATE tasks SET ${sets}, updated_at = @updated_at WHERE id = @id AND ${guard}`)
        .run({ ...changes, id, userId, updated_at: now() });
      return byIdVisible.get({ id, userId });
    },

    remove: (id, userId) => remove.run({ id, userId }).changes > 0,
  };
}

module.exports = { createTaskRepo };
