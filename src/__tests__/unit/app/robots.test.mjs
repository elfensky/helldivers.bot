import { afterEach, describe, expect, test, vi } from 'vitest';

import robots from '@/app/robots.js';

afterEach(() => vi.unstubAllEnvs());

describe('robots', () => {
    test('production build allows crawlers and lists the sitemap', () => {
        vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', 'production');
        expect(robots()).toStrictEqual({
            rules: { userAgent: '*', allow: '/' },
            sitemap: 'https://helldivers.bot/sitemap.xml',
        });
    });

    test.each(['staging', '', undefined])(
        'fails closed when NEXT_PUBLIC_DEPLOY_ENV is %j',
        (value) => {
            vi.stubEnv('NEXT_PUBLIC_DEPLOY_ENV', value);
            const result = robots();
            expect(result).toStrictEqual({ rules: { userAgent: '*', disallow: '/' } });
            expect(result).not.toHaveProperty('sitemap');
        },
    );
});
