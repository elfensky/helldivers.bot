import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time';
import { successResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';

export async function GET(request) {
    const start = performance.now();
    return successResponse(200, start, {
        alive: true,
        performanceTime: roundedPerformanceTime(start),
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
