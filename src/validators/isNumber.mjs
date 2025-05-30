import { z } from 'zod/v4';

export const zodIsNumber = z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive(),
);
