import fs from 'fs';
import path from 'path';
import DocsClient from '@/shared/components/OpenAPI/DocsClient';

export const metadata = {
    title: 'API Reference | Helldivers Bot',
    description:
        'Interactive API documentation for the Helldivers Bot API — explore endpoints, request/response schemas, and authentication.',
    alternates: { canonical: '/docs/api' },
    openGraph: { url: '/docs/api' },
};

export default function ApiReferencePage() {
    const filePath = path.join(process.cwd(), 'public', 'openapi.json');
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const openapi = JSON.parse(jsonData);

    return (
        <>
            <h1 className="font-display text-3xl text-primary">API Reference</h1>
            <p className="mt-2 mb-4 leading-[1.7] text-text">
                Interactive documentation for the Helldivers Bot API. Log in to create an
                API key, then use the endpoints below.
            </p>
            <DocsClient spec={openapi} />
        </>
    );
}
