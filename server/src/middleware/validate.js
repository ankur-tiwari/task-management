'use strict';
const { badRequest } = require('../utils/errors');

/**
 * validate({ body, params, query }) parses each part with a zod schema and
 * exposes the sanitized result on req.valid.{body,params,query}.
 * Handlers must read from req.valid — never from raw req.body.
 */
function validate(schemas) {
  return (req, _res, next) => {
    req.valid = {};
    const details = [];
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue;
      const result = schemas[part].safeParse(req[part] ?? {});
      if (result.success) {
        req.valid[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          const field = issue.path.length ? issue.path.join('.') : part;
          details.push({ field: issue.code === 'unrecognized_keys' ? 'unknown_field' : field, message: issue.message });
        }
      }
    }
    if (details.length) return next(badRequest('Validation failed.', details));
    next();
  };
}

module.exports = { validate };
