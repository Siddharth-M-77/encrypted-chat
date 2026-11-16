import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export const notFound = (_req, res) =>
  res.status(404).json({ success: false, message: 'Route not found', data: null });

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, _next) => {
  let status = err.status || err.statusCode || 500;
  let message = err.message;
  let data = err.details ?? null;

  // Mongo duplicate key (e.g. username already taken)
  if (err?.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'value';
    message = `${field} already in use`;
  } else if (err?.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier';
  } else if (err?.name === 'ValidationError') {
    status = 400;
    message = 'Validation failed';
    data = Object.values(err.errors || {}).map((e) => ({ path: e.path, message: e.message }));
  } else if (err?.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 25 MB)' : 'Invalid upload';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    message = 'Payload too large';
  } else if (err instanceof SyntaxError && 'body' in err) {
    status = 400;
    message = 'Invalid JSON';
  } else if (!err.isOperational && status >= 500) {
    // Do not leak internals for unexpected errors.
    logger.error({ err, path: req.path }, 'Unhandled error');
    message = env.isProd ? 'Internal server error' : err.message;
  }

  res.status(status).json({ success: false, message, data });
};
