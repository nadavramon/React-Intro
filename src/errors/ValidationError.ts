import { AppError } from "./AppError.ts";

export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}