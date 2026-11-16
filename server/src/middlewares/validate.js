import { ApiError } from '../utils/ApiError.js';

// Validate body/query/params with zod. Parsed values go to req.valid.* because
// Express 5 exposes req.query as a read-only getter.
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const part of ['body', 'query', 'params']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    req.valid[part] = result.data;
  }
  next();
};
