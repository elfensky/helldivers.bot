import { performance } from 'perf_hooks';
import { errorResponse } from '@/utils/responses';

export const methodNotAllowed = () => {
    const start = performance.now();
    return errorResponse(405, start);
};
