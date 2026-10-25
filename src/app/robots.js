import { SITE_URL } from '@/config/site.mjs';

export default function robots() {
    // Fails closed: only a production build is crawlable. The value is inlined at
    // build, so the image decides; the runtime env does not.
    if (process.env.NEXT_PUBLIC_DEPLOY_ENV !== 'production') {
        return { rules: { userAgent: '*', disallow: '/' } };
    }
    return {
        rules: { userAgent: '*', allow: '/' },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
