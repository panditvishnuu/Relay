import { ZodError } from 'zod';
import { ApiError } from '../lib/ApiError.js';
import { isDev } from '../config/env.js';

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars -- Express identifies error middleware by arity
export function errorHandler(err, req, res, next) {
  let status = err.status ?? 500;
  let message = err.message ?? 'Internal server error';
  let details = err.details;

  if (err instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = err.flatten().fieldErrors;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
    details = err.keyValue;
  }

  if (status >= 500) console.error('[error]', err);

  res.status(status).json({
    error: { message, ...(details && { details }), ...(isDev && status >= 500 && { stack: err.stack }) },
  });
}
