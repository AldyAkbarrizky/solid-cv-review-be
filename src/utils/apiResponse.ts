import { Response } from 'express';

interface IApiResponse {
  status: 'success' | 'error';
  statusCode: number;
  data?: any;
  message?: string;
  error?: any;
}

export class ApiResponse {
  static success(res: Response, data: any, statusCode = 200): Response {
    const response: IApiResponse = {
      status: 'success',
      statusCode,
      data,
    };
    return res.status(statusCode).json(response);
  }

  static error(res: Response, message: string, statusCode = 500, error?: any): Response {
    const response: IApiResponse = {
      status: 'error',
      statusCode,
      message,
    };
    if (error) {
      response.error = error;
    }
    return res.status(statusCode).json(response);
  }
}
