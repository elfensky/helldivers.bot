import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed.mjs';
import { proxyUmamiScript } from '@/shared/utils/umami.mjs';

// A route handler, not a rewrite: an external rewrite forwards every visitor
// header, cookies included, to the Umami host.
export const GET = () => proxyUmamiScript('script.js');
export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
