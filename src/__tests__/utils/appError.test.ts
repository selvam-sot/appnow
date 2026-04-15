import { AppError } from '../../utils/appError.util';

describe('AppError', () => {
  it('should create an error with statusCode and message', () => {
    const error = new AppError('Not found', 404);

    expect(error.message).toBe('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.isOperational).toBe(true);
  });

  it('should set status to "fail" for 4xx errors', () => {
    const error400 = new AppError('Bad request', 400);
    const error401 = new AppError('Unauthorized', 401);
    const error404 = new AppError('Not found', 404);
    const error422 = new AppError('Unprocessable', 422);

    expect(error400.status).toBe('fail');
    expect(error401.status).toBe('fail');
    expect(error404.status).toBe('fail');
    expect(error422.status).toBe('fail');
  });

  it('should set status to "error" for 5xx errors', () => {
    const error500 = new AppError('Internal error', 500);
    const error503 = new AppError('Service unavailable', 503);

    expect(error500.status).toBe('error');
    expect(error503.status).toBe('error');
  });

  it('should be an instance of Error', () => {
    const error = new AppError('Test', 400);

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should have a stack trace', () => {
    const error = new AppError('Test', 400);

    expect(error.stack).toBeDefined();
  });
});
