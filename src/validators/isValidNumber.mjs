import { z } from 'zod';

export const isValidNumber = z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive(),
);
