/**
 * BetterAuth catch-all route handler.
 *
 * Delegates all /api/auth/* requests to BetterAuth via toNextJsHandler.
 * Handles OAuth callbacks, session management, and sign-out.
 */
import { auth } from '@/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
