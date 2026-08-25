/** Replaces req.body with the parsed result; ZodError is shaped by the error middleware. */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};
