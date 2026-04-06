import { generateOpenApiSpec } from '@/shared/utils/api/openapi.registry';
import EndpointCard from './EndpointCard';

export const metadata = {
    title: 'API Reference | Helldivers Bot',
    description:
        'API documentation for the Helldivers Bot API — endpoints, request/response schemas, and authentication.',
    alternates: { canonical: '/docs/api' },
    openGraph: { url: '/docs/api' },
};

export default function ApiReferencePage() {
    const spec = generateOpenApiSpec();
    const paths = Object.entries(spec.paths);
    const schemas = spec.components?.schemas ?? {};

    return (
        <>
            <h1 className="font-display text-primary">API Reference</h1>
            <p className="mt-2 mb-6 leading-[1.7] text-text-muted">
                Endpoint reference for the Helldivers Bot API. All responses follow a
                standard envelope with{' '}
                <code className="font-mono text-small text-text">time</code>,{' '}
                <code className="font-mono text-small text-text">code</code>,{' '}
                <code className="font-mono text-small text-text">message</code>, and{' '}
                <code className="font-mono text-small text-text">data</code> /{' '}
                <code className="font-mono text-small text-text">error</code> fields.
            </p>
            <div className="flex flex-col gap-3">
                {paths.map(([path, methods]) => (
                    <EndpointCard
                        key={path}
                        path={path}
                        methods={methods}
                        schemas={schemas}
                    />
                ))}
            </div>
        </>
    );
}
