import { spawnSync } from 'node:child_process';
import { serwist } from '@serwist/next/config';

const revision =
    spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ??
    crypto.randomUUID();

export default serwist({
    swSrc: 'src/sw.js',
    swDest: 'public/sw.js',
    additionalPrecacheEntries: [{ url: '/', revision }],
});
