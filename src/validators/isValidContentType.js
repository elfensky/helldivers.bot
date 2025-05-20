import { z } from 'zod/v4';

//used by /api/h1/rebroadcast to check if request type is a proper form-data or x-www-form-urlencoded
export const isValidContentType = z
    .string()
    .refine(
        (val) =>
            val.includes('multipart/form-data') ||
            val.includes('application/x-www-form-urlencoded'),
        {
            message: 'Invalid content type',
        },
    );
