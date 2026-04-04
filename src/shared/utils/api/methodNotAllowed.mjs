import { performance } from 'perf_hooks';
import { errorResponse } from '@/shared/utils/api/responses';

export const methodNotAllowed = () => {
    const start = performance.now();
    return errorResponse(405, start);
};
