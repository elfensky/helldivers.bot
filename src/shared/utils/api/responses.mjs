import { performanceTime } from '@/shared/utils/time.mjs';
import { NextResponse } from 'next/server';

const ERROR_MESSAGES = {
    400: 'Bad Request',
    401: 'Unauthorized', //idk who you are, but you're not allowed
    403: 'Forbidden', //I know who you are, but still not allowed
    404: 'Not found',
    405: 'Method not allowed',
    418: "I'm a teapot",
    429: 'Too many requests',
    500: 'Internal server error',
    502: 'Bad gateway', //if can't reach official api
    503: 'Service unavailable',
};

/**
 * Returns a standardized JSON error response using NextResponse.
 *
 * @param {number} code - The HTTP error status code (should be 4xx or 5xx).
 * @param {number} start - The start time (for calculating performance time).
 * @param {unknown} error - The error object to include in the response.
 * @returns {NextResponse} A NextResponse JSON object with timing, code, message, and null data.
 * @throws {Error} If the code is not an error status code (i.e., not 4xx or 5xx).
 */
export function errorResponse(code, start, error = null) {
    if (code < 400 || code > 599) throw new Error('Invalid error code');

    const known = ERROR_MESSAGES[code];
    const message = known ?? 'Unknown error';
    const status = known === undefined ? 500 : code; // unknown error code -> 500

    const body = JSON.stringify(
        {
            time: performanceTime(start),
            code: status,
            message: message,
            error: error,
        },
        (_, v) => (typeof v === 'bigint' ? Number(v) : v),
    );
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

const SUCCESS_MESSAGES = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No content',
};

/**
 * Returns a standardized JSON success response using NextResponse.
 *
 * @param {number} code - The HTTP status code (should be 2xx).
 * @param {number} start - The start time (for calculating performance time).
 * @param {unknown} data - The data to include in the response.
 * @param {{ headers?: Record<string, string> }} [opts] - Optional extra
 *   response headers (e.g. `Cache-Control: no-store` for the live route).
 *   These are merged on top of the default `Content-Type: application/json`.
 * @returns {NextResponse} A NextResponse JSON object with timing, code, message, and data.
 * @throws {Error} If the code does not start with "2".
 */
export function successResponse(code, start, data, opts = {}) {
    if (code < 200 || code > 299) throw new Error('Invalid success code');

    const known = SUCCESS_MESSAGES[code];
    const message = known ?? 'Unknown';
    const status = known === undefined ? 200 : code; // unknown success code -> 200

    const body = JSON.stringify(
        {
            time: performanceTime(start),
            code: status,
            message: message,
            data: data,
        },
        (_, v) => (typeof v === 'bigint' ? Number(v) : v),
    );
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    });
}
