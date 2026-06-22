import { generateOpenApiSpec } from '@/shared/utils/api/openapiRegistry.mjs';
import EndpointCard from './EndpointCard';

export const metadata = {
    title: 'Rebroadcast API | Helldivers Bot',
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
            <h1 className="font-display text-primary">Rebroadcast API</h1>
            <p className="mt-2 mb-6 leading-[1.7] text-text-muted">
                Endpoint reference for the Helldivers Bot API. All responses follow a
                standard envelope with{' '}
                <code className="font-mono text-small text-text">time</code>,{' '}
                <code className="font-mono text-small text-text">code</code>,{' '}
                <code className="font-mono text-small text-text">message</code>, and{' '}
                <code className="font-mono text-small text-text">data</code> /{' '}
                <code className="font-mono text-small text-text">error</code> fields.
            </p>

            <div className="mb-8 border border-ghost bg-surface-1 p-4">
                <h2 className="mb-3 font-display text-h3 text-primary">
                    Response Envelopes
                </h2>
                <div className="mb-4">
                    <h3 className="mb-1 font-mono text-body text-text">
                        Standard Envelope
                    </h3>
                    <p className="mb-2 text-body leading-[1.7] text-text-muted">
                        Used by the{' '}
                        <code className="font-mono text-small text-text">
                            /api/v1/h1/*
                        </code>{' '}
                        reads and{' '}
                        <code className="font-mono text-small text-text">
                            /api/h1/campaign
                        </code>
                        . The <code className="font-mono text-small text-text">time</code>{' '}
                        field is elapsed milliseconds (floating-point). The{' '}
                        <code className="font-mono text-small text-text">message</code>{' '}
                        field is derived from the HTTP status code.
                    </p>
                    <pre className="overflow-x-auto bg-surface-2 p-3 font-mono text-small text-text">
                        {`// Success
{ "time": 42.5, "code": 200, "message": "OK", "data": { ... } }

// Error
{ "time": 42.5, "code": 400, "message": "Bad Request", "error": "details" }`}
                    </pre>
                </div>
                <div className="mb-4">
                    <h3 className="mb-1 font-mono text-body text-text">
                        Rebroadcast Envelope
                    </h3>
                    <p className="mb-2 text-body leading-[1.7] text-text-muted">
                        Used by{' '}
                        <code className="font-mono text-small text-text">
                            /api/h1/rebroadcast
                        </code>{' '}
                        error paths only. Mirrors the official HD1 API error format so
                        proxy clients don&apos;t need to detect the error source.
                        Successful rebroadcast responses return raw JSON directly.
                    </p>
                    <pre className="overflow-x-auto bg-surface-2 p-3 font-mono text-small text-text">
                        {`{ "time": 1711234567, "error_code": 0, "error_message": "Invalid Content Type" }`}
                    </pre>
                </div>
                <div>
                    <h3 className="mb-1 font-mono text-body text-text">Authentication</h3>
                    <p className="text-body leading-[1.7] text-text-muted">
                        The versioned{' '}
                        <code className="font-mono text-small text-text">
                            /api/v1/h1/*
                        </code>{' '}
                        endpoints and{' '}
                        <code className="font-mono text-small text-text">
                            /api/h1/rebroadcast
                        </code>{' '}
                        require a user API key via{' '}
                        <code className="font-mono text-small text-text">
                            Authorization: Bearer &lt;key&gt;
                        </code>
                        . Keys are created and managed from the user dashboard.{' '}
                        <code className="font-mono text-small text-text">
                            /api/h1/update
                        </code>{' '}
                        is internal (worker-only, Bearer token must match{' '}
                        <code className="font-mono text-small text-text">UPDATE_KEY</code>
                        ).{' '}
                        <code className="font-mono text-small text-text">
                            /api/h1/live
                        </code>{' '}
                        is the dashboard&apos;s own feed — internal, not part of the
                        public contract.{' '}
                        <code className="font-mono text-small text-text">
                            /api/h1/campaign
                        </code>{' '}
                        is public but deprecated.
                    </p>
                </div>
            </div>

            <div className="mb-8 border border-ghost bg-surface-1 p-4">
                <h2 className="mb-3 font-display text-h3 text-primary">
                    Versioning &amp; API surface
                </h2>
                <p className="mb-4 text-body leading-[1.7] text-text-muted">
                    Human-readable endpoints live under a versioned path —{' '}
                    <code className="font-mono text-small text-text">
                        {'/api/v1/h1/{status,stats,season,map}'}
                    </code>
                    . Within <code className="font-mono text-small text-text">/v1</code>{' '}
                    the contract is stable: field names and semantics never change, and
                    additive changes (new fields, new optional query filters) are
                    non-breaking. A breaking shape change introduces{' '}
                    <code className="font-mono text-small text-text">/v2</code> while{' '}
                    <code className="font-mono text-small text-text">/v1</code> stays
                    operational. The version lives in the path — there is no header-based
                    version negotiation. The endpoint reference below documents the{' '}
                    <strong className="text-text">public surface only</strong> — internal
                    plumbing is noted here but intentionally left out of the spec.
                </p>
                <dl className="flex flex-col gap-3">
                    <div>
                        <dt className="font-mono text-small text-text">/api/v1/h1/*</dt>
                        <dd className="text-body leading-[1.7] text-text-muted">
                            Human-readable REST projection. Versioned, key-gated (user API
                            key).
                        </dd>
                    </div>
                    <div>
                        <dt className="font-mono text-small text-text">
                            /api/h1/rebroadcast
                        </dt>
                        <dd className="text-body leading-[1.7] text-text-muted">
                            Drop-in replacement for the official HD1 API (raw wire
                            format). Deliberately{' '}
                            <strong className="text-text">unversioned and stable</strong>{' '}
                            — it mirrors a frozen external contract, so it sits a level
                            above{' '}
                            <code className="font-mono text-small text-text">/v1</code>{' '}
                            and never moves under it. Key-gated.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-mono text-small text-text">
                            /api/h1/live · /api/h1/update
                        </dt>
                        <dd className="text-body leading-[1.7] text-text-muted">
                            <strong className="text-text">Internal</strong> — the
                            dashboard&apos;s rich live feed and the worker&apos;s update
                            trigger (
                            <code className="font-mono text-small text-text">
                                UPDATE_KEY
                            </code>
                            -gated). Not part of the public contract and excluded from the
                            spec below; they can change without notice.
                        </dd>
                    </div>
                    <div>
                        <dt className="font-mono text-small text-text">
                            /api/h1/campaign
                        </dt>
                        <dd className="text-body leading-[1.7] text-text-muted">
                            <strong className="text-text">Deprecated</strong> — superseded
                            by{' '}
                            <code className="font-mono text-small text-text">
                                /api/v1/h1/status
                            </code>{' '}
                            +{' '}
                            <code className="font-mono text-small text-text">
                                /api/v1/h1/stats
                            </code>
                            .
                        </dd>
                    </div>
                </dl>
            </div>

            <h2 className="mb-3 font-display text-h3 text-primary">Endpoints</h2>
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
