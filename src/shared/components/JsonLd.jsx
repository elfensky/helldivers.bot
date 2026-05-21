import { headers } from 'next/headers';

/**
 * Async server component that renders JSON-LD structured data with CSP nonce.
 * Only used with static schema objects — never with user input.
 * @param {{ data: object | object[] }} props - Component props
 */
export default async function JsonLd({ data }) {
    const nonce = (await headers()).get('x-nonce') ?? undefined;

    return (
        <script
            nonce={nonce}
            type="application/ld+json"
            suppressHydrationWarning
            // Safe: data is always a static schema object defined in source code, never user input
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
