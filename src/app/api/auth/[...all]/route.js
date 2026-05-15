/**
 * BetterAuth catch-all route handler.
 *
 * Delegates all /api/auth/* requests to BetterAuth via toNextJsHandler.
 * Handles OAuth callbacks, session management, and sign-out.
 * Returns 503 when auth is not configured.
 */
import { auth } from '@/auth';

const disabledHandler = () =>
    Response.json({ error: 'Auth is not configured on this instance' }, { status: 503 });

let GET = disabledHandler;
let POST = disabledHandler;

if (auth) {
    const { toNextJsHandler } = await import('better-auth/next-js');
    ({ GET, POST } = toNextJsHandler(auth));
}

export { GET, POST };
