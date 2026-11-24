'use strict';
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { badRequest, forbidden, notFound } = require('../utils/errors');
const v = require('../validators/task');

function createTasksRouter({ taskRepo, userRepo }) {
  const router = express.Router();
  router.use(requireAuth(userRepo));
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  const assertAssigneeExists = (id) => {
    if (id && !userRepo.exists(id)) {
      throw badRequest('Validation failed.', [{ field: 'assigned_to', message: 'Assignee does not exist.' }]);
    }
  };

  /**
   * Object-level authorization (BOLA):
   *  - not visible to the caller  -> 404 (don't reveal existence)
   *  - visible but not permitted  -> 403
   */
  const loadVisibleOr404 = (id, userId) => taskRepo.findVisible(id, userId) ?? (() => { throw notFound('Task not found.'); })();

  router.get('/', validate({ query: v.listQuerySchema }), (req, res) => {
    const { page, limit } = req.valid.query;
    const { items, total } = taskRepo.list(req.user.id, req.valid.query);
    res.json({ data: items, meta: { total, page, limit, total_pages: Math.max(1, Math.ceil(total / limit)) } });
  });

  router.post('/', validate({ body: v.createTaskSchema }), (req, res) => {
    assertAssigneeExists(req.valid.body.assigned_to);
    res.status(201).json({ data: taskRepo.create(req.user.id, req.valid.body) });
  });

  router.get('/:id', validate({ params: v.idParamSchema }), (req, res) => {
    res.json({ data: loadVisibleOr404(req.valid.params.id, req.user.id) });
  });

  const update = (partial) => (req, res) => {
    const { id } = req.valid.params;
    const task = loadVisibleOr404(id, req.user.id);
    const changes = req.valid.body;
    const isCreator = task.created_by === req.user.id;

    // Assignees (non-creators) may only change the status of their task.
    if (!isCreator && !(partial && Object.keys(changes).every((k) => k === 'status'))) throw forbidden();

    assertAssigneeExists(changes.assigned_to);
    res.json({ data: taskRepo.update(id, req.user.id, changes, { creatorOnly: isCreator }) });
  };

  router.put('/:id', validate({ params: v.idParamSchema, body: v.createTaskSchema }), update(false));
  router.patch('/:id', validate({ params: v.idParamSchema, body: v.patchTaskSchema }), update(true));

  router.delete('/:id', validate({ params: v.idParamSchema }), (req, res) => {
    const task = loadVisibleOr404(req.valid.params.id, req.user.id);
    if (task.created_by !== req.user.id) throw forbidden('Only the creator can delete a task.');
    taskRepo.remove(task.id, req.user.id);
    res.status(204).end();
  });

  return router;
}

module.exports = { createTasksRouter };
