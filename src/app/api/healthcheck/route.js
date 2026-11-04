import { performance } from 'perf_hooks';
import { after } from 'next/server';
import { roundedPerformanceTime } from '@/shared/utils/time.mjs';
import { successResponse, errorResponse } from '@/shared/utils/api/responses.mjs';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { registerInstance } from '@/update/instance.mjs';
import db from '@/db/db';

export async function GET(_request) {
    const start = performance.now();
    const { error } = await tryCatch(db.$queryRaw`SELECT 1`);
    if (error) {
        reportError(error, { route: '/api/healthcheck', stage: 'db-ping' });
        return errorResponse(503, start, 'database unreachable');
    }
    // Replica registry (#596): deferred, and a failure never changes the answer.
    after(async () => {
        const { error: registerError } = await tryCatch(registerInstance());
        if (registerError) {
            reportError(registerError, {
                route: '/api/healthcheck',
                stage: 'instance-register',
                level: 'warning',
            });
        }
    });
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
