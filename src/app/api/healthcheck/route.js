import { performance } from 'perf_hooks';
import { roundedPerformanceTime } from '@/shared/utils/time';
import { successResponse, errorResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';
import { tryCatch } from '@/shared/utils/tryCatch';
import db from '@/db/db';

export async function GET(request) {
    const start = performance.now();
    const { error } = await tryCatch(db.$queryRaw`SELECT 1`);
    if (error) {
        return errorResponse(503, start, 'database unreachable');
    }
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
