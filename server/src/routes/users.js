'use strict';
const express = require('express');
const { requireAuth } = require('../middleware/auth');

// Minimal directory for the "assign to" dropdown: id + name only (no emails).
function createUsersRouter({ userRepo }) {
  const router = express.Router();
  router.get('/', requireAuth(userRepo), (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ data: userRepo.directory() });
  });
  return router;
}

module.exports = { createUsersRouter };
