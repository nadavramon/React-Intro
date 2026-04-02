import { Request, Response, NextFunction } from 'express';
import { format } from 'date-fns';

export function logger(req: Request, res: Response, next: NextFunction): void {
    const formattedDate = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
    console.log(`[${formattedDate}] ${req.method} ${req.path}`);
    next();
}
