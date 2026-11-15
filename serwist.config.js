import { serwist } from '@serwist/next/config';

// No precache entry for `/`: the precache serves its entries cache-first, and
// `/` renders the session (header, admin widget). Pages go to the runtime
// NetworkFirst cache instead, so offline they show the last copy seen online.
export default serwist({
    swSrc: 'src/sw.js',
    swDest: 'public/sw.js',
});
