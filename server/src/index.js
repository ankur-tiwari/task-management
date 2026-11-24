'use strict';
const config = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

const db = openDatabase(config.databasePath);
const app = createApp(db);

const server = app.listen(config.port, () => {
  console.log(`API listening on :${config.port} (${config.env})`);
});

const shutdown = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
