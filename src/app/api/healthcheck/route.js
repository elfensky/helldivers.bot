import { performance } from 'perf_hooks';
import { successResponse } from '@/utils/responses';
import { methodNotAllowed } from '@/utils/methodNotAllowed';

export async function GET(request) {
    const start = performance.now();
    return successResponse(200, start, { alive: true });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
