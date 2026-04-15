import { asyncHandler } from '../../utils/asyncHandler.util';
import type { Request, Response, NextFunction } from 'express';

describe('asyncHandler', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call the wrapped function with req, res, next', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(mockFn);

    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
  });

  it('should call next with error when async function rejects', async () => {
    const error = new Error('Test error');
    const mockFn = jest.fn().mockRejectedValue(error);
    const handler = asyncHandler(mockFn);

    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
  });

  it('should not call next when async function resolves', async () => {
    const mockFn = jest.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(mockFn);

    await handler(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
  });

});
