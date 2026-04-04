import sseManager from '@/shared/utils/sse/sseManager';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getClientIp(request) {
    return (
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown'
    );
}

export async function GET(request) {
    // Initialize SSE manager on first request
    await sseManager.init();

    if (!sseManager.healthy) {
        return new Response('SSE service unavailable', { status: 503 });
    }

    const ip = getClientIp(request);

    let controllerRef;
    const stream = new ReadableStream({
        start(controller) {
            controllerRef = controller;
            const accepted = sseManager.subscribe(controller, ip);
            if (!accepted) {
                controller.close();
            }
        },
        cancel() {
            if (controllerRef) {
                sseManager.unsubscribe(controllerRef);
            }
        },
    });

    // Check if subscription was rejected (connection limits)
    // The stream will close immediately if not accepted

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
