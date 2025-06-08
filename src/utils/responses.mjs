import { performanceTime } from '@/utils/time';
import { NextResponse } from 'next/server';

/**
 * Returns a standardized JSON error response using NextResponse.
 *
 * @param {number} code - The HTTP error status code (should be 4xx or 5xx).
 * @param {number} start - The start time (for calculating performance time).
 * @param {*} error - The error object to include in the response.
 * @returns {NextResponse} A NextResponse JSON object with timing, code, message, and null data.
 * @throws {Error} If the code is not an error status code (i.e., not 4xx or 5xx).
 */
export function errorResponse(code, start, error = null) {
    if (String(code).startsWith('1')) throw new Error('Invalid error code');
    if (String(code).startsWith('2')) throw new Error('Invalid error code');
    if (String(code).startsWith('3')) throw new Error('Invalid error code');

    let status = code;
    let message = '';

    switch (code) {
        case 400:
            message = 'Bad Request';
            break;
        case 401:
            message = 'Unauthorized'; //idk who you are, but you're not allowed
            break;
        case 403:
            message = 'Forbidden'; //I know who you are, but still not allowed
            break;
        case 404:
            message = 'Not found';
            break;
        case 405:
            message = 'Method not allowed';
            break;
        case 418:
            message = "I'm a teapot";
            break;
        case 429:
            message = 'Too many requests';
            break;
        case 451:
            message = 'Unavailable for legal reasons';
            break;
        case 500:
            message = 'Internal server error';
            break;
        case 501:
            message = 'Not implemented';
            break;
        case 502:
            message = 'Bad gateway'; //if can't reach official api
            break;
        case 503:
            message = 'Service unavailable';
            break;
        default:
            message = 'Unknown error';
            status = 500;
            break;
    }

    return NextResponse.json(
        {
            time: performanceTime(start),
            code: status,
            message: message,
            error: error,
        },
        { status },
    );
}

/**
 * Returns a standardized JSON success response using NextResponse.
 *
 * @param {number} code - The HTTP status code (should be 2xx).
 * @param {number} start - The start time (for calculating performance time).
 * @param {*} data - The data to include in the response.
 * @returns {NextResponse} A NextResponse JSON object with timing, code, message, and data.
 * @throws {Error} If the code does not start with "2".
 */
export function successResponse(code, start, data) {
    if (!String(code).startsWith('2')) throw new Error('Invalid success code');

    let status = code;
    let message = '';

    switch (code) {
        case 200:
            message = 'OK';
            break;
        case 201:
            message = 'Created';
            break;
        case 202:
            message = 'Accepted';
            break;
        case 203:
            message = 'Non-authoritative information';
            break;
        case 204:
            message = 'No content';
            break;
        default:
            message = 'Unknown';
            status = 200;
            break;
    }

    return NextResponse.json(
        {
            time: performanceTime(start),
            code: status,
            message: message,
            data: data,
        },
        { status },
    );
}
