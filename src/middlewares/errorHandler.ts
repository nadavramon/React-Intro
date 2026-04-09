import { Request, Response, NextFunction } from 'express';

type ErrorPayload = {
        error: string;
        message: string;
        stack?: string;
    };

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    if (res.headersSent) {
        return next(err);
    }

    const statusCode = err.status || err.statusCode || 500;

    console.error(`[Error] ${req.method} ${req.path} >> StatusCode:: ${statusCode}\n`, err);

    const payload: ErrorPayload = {
        error: statusCode === 500 ? 'Internal Server Error' : 'Error',
        message: err.message || 'An unexpected error occurred',
    };

    if (process.env.NODE_ENV === 'development') {
        payload.stack = err.stack;
    }

    res.status(statusCode).json(payload);
};
