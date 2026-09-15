import { log } from '../config/logging.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const errorHandler = (err: any, _req: any, res: any, _next: any) => {
  log(
    'error',
    `Error caught by centralized handler: ${err.message}`,
    err.stack
  );
  // Libraries set `statusCode`; service errors (createServiceError) set `status`.
  const declaredStatus = Number(err.statusCode ?? err.status);
  let statusCode =
    Number.isInteger(declaredStatus) &&
    declaredStatus >= 400 &&
    declaredStatus < 600
      ? declaredStatus
      : 500;
  let message = err.message || 'Internal Server Error';
  // Handle specific error types if needed (e.g., database errors, validation errors)
  switch (err.name) {
    case 'UnauthorizedError':
      statusCode = 401;
      message = 'Unauthorized: Invalid or missing token.';
      break;
    case 'ForbiddenError': // Example for custom forbidden errors
      statusCode = 403;
      message = 'Forbidden: You do not have permission to perform this action.';
      break;
    case 'ValidationError': // Example for validation errors
      statusCode = 400;
      message = err.message;
      break;
    default:
      // Handle cases not based on err.name inside the default
      if (err.code === '23505') {
        statusCode = 409;
        message =
          'Conflict: A resource with this unique identifier already exists.';
      }
      break;
  }
  if (statusCode >= 500) {
    // A server-side failure message carries internals (SQL, hostnames) the
    // client cannot act on.
    message = 'Internal Server Error';
  }
  res.status(statusCode).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined, // Only send stack in development
  });
};
export default errorHandler;
