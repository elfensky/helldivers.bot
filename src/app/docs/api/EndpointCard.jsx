import SchemaTable from './SchemaTable';

const METHOD_COLORS = {
    get: 'text-primary',
    post: 'text-success',
    delete: 'text-danger',
    put: 'text-outline',
    patch: 'text-text-muted',
};

const METHOD_ACCENT = {
    get: 'bg-primary',
    post: 'bg-success',
    delete: 'bg-danger',
    put: 'bg-outline',
    patch: 'bg-outline-variant',
};

function MethodBadge({ method }) {
    const color = METHOD_COLORS[method] ?? 'text-text-muted';
    return (
        <span
            className={`inline-block bg-surface-3 px-2 py-0.5 font-mono text-xs font-bold uppercase ${color}`}
        >
            {method}
        </span>
    );
}

function pathToSlug(path) {
    return path.replace(/^\//, '').replace(/\//g, '-');
}

function SseDescription() {
    return (
        <div className="mt-2 space-y-2 text-sm text-text-muted">
            <p>
                Response format:{' '}
                <span className="font-mono text-text">
                    Server-Sent Events (text/event-stream)
                </span>
            </p>
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-ghost text-left tracking-wide uppercase">
                        <th className="py-1 pr-3 font-semibold">Header</th>
                        <th className="py-1 font-semibold">Value</th>
                    </tr>
                </thead>
                <tbody className="font-mono">
                    <tr className="border-b border-ghost/50">
                        <td className="py-1 pr-3 text-text">Content-Type</td>
                        <td className="py-1">text/event-stream</td>
                    </tr>
                    <tr className="border-b border-ghost/50">
                        <td className="py-1 pr-3 text-text">Cache-Control</td>
                        <td className="py-1">no-cache, no-store</td>
                    </tr>
                    <tr className="border-b border-ghost/50">
                        <td className="py-1 pr-3 text-text">Connection</td>
                        <td className="py-1">keep-alive</td>
                    </tr>
                    <tr className="border-b border-ghost/50">
                        <td className="py-1 pr-3 text-text">X-Accel-Buffering</td>
                        <td className="py-1">no</td>
                    </tr>
                </tbody>
            </table>
            <pre className="bg-surface-0 p-3 font-mono text-xs text-text">
                {`event: campaign_update\ndata: {"season":1,"status":{...}}\n`}
            </pre>
        </div>
    );
}

function ParametersTable({ parameters }) {
    if (!parameters?.length) return null;
    return (
        <div className="mt-3">
            <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Parameters
            </h4>
            <table className="mt-2 w-full text-sm">
                <thead>
                    <tr className="border-b border-ghost text-left text-xs tracking-wide text-text-muted uppercase">
                        <th className="py-1.5 pr-3 font-semibold">Name</th>
                        <th className="py-1.5 pr-3 font-semibold">In</th>
                        <th className="py-1.5 pr-3 font-semibold">Type</th>
                        <th className="py-1.5 pr-3 font-semibold">Required</th>
                        <th className="py-1.5 font-semibold">Description</th>
                    </tr>
                </thead>
                <tbody>
                    {parameters.map((param) => (
                        <tr key={param.name} className="border-b border-ghost/50">
                            <td className="py-1.5 pr-3 font-mono text-xs text-text">
                                {param.name}
                            </td>
                            <td className="py-1.5 pr-3 text-xs text-text-muted">
                                {param.in}
                            </td>
                            <td className="py-1.5 pr-3 font-mono text-xs text-text-muted">
                                {param.schema?.type ?? 'string'}
                            </td>
                            <td className="py-1.5 pr-3 text-xs">
                                {param.required ?
                                    <span className="text-primary">yes</span>
                                :   <span className="text-text-muted">no</span>}
                            </td>
                            <td className="py-1.5 text-xs text-text-muted">
                                {param.description ?? ''}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function RequestBody({ requestBody, schemas }) {
    if (!requestBody?.content) return null;
    return (
        <div className="mt-3">
            <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Request Body
                {requestBody.required && (
                    <span className="ml-1 text-primary">(required)</span>
                )}
            </h4>
            {Object.entries(requestBody.content).map(([contentType, { schema }]) => (
                <div key={contentType} className="mt-1">
                    <span className="font-mono text-xs text-text-muted">
                        {contentType}
                    </span>
                    <SchemaTable schema={schema} schemas={schemas} />
                </div>
            ))}
        </div>
    );
}

function Responses({ responses, schemas }) {
    if (!responses) return null;
    return (
        <div className="mt-3">
            <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                Responses
            </h4>
            <div className="mt-2 space-y-2">
                {Object.entries(responses).map(([code, response]) => {
                    const isSse = response.content?.['text/event-stream'];
                    return (
                        <div key={code}>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`font-mono text-xs font-bold ${
                                        code.startsWith('2') ? 'text-success'
                                        : code.startsWith('4') ? 'text-primary'
                                        : 'text-danger'
                                    }`}
                                >
                                    {code}
                                </span>
                                <span className="text-xs text-text-muted">
                                    {response.description}
                                </span>
                            </div>
                            {isSse && <SseDescription />}
                            {!isSse &&
                                response.content &&
                                Object.entries(response.content).map(
                                    ([ct, { schema }]) => (
                                        <div key={ct} className="ml-2">
                                            <SchemaTable
                                                schema={schema}
                                                schemas={schemas}
                                            />
                                        </div>
                                    ),
                                )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function EndpointCard({ path, methods, schemas }) {
    const methodEntries = Object.entries(methods);
    const isMultiMethod = methodEntries.length > 1;
    const slug = pathToSlug(path);

    // Accent color: single-method uses method color, multi-method uses primary
    const accentColor =
        isMultiMethod ? 'bg-primary' : (
            (METHOD_ACCENT[methodEntries[0][0]] ?? 'bg-primary')
        );

    return (
        <details
            id={slug}
            className="group border border-ghost bg-surface-1 transition-colors"
        >
            <summary className="grid cursor-pointer list-none grid-cols-[1fr_4px] hover:bg-surface-2">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    {methodEntries.map(([method]) => (
                        <MethodBadge key={method} method={method} />
                    ))}
                    <code className="font-mono text-sm text-text">{path}</code>
                    {!isMultiMethod && methodEntries[0][1].summary && (
                        <span className="text-sm text-text-muted">
                            — {methodEntries[0][1].summary}
                        </span>
                    )}
                </div>
                <div className={accentColor} />
            </summary>

            <div className="border-t border-ghost px-4 py-4">
                {methodEntries.map(([method, operation], index) => (
                    <section
                        key={method}
                        id={`${method}-${slug}`}
                        className={index > 0 ? 'mt-4 border-t border-ghost/50 pt-4' : ''}
                    >
                        {isMultiMethod && (
                            <div className="mb-2 flex items-center gap-2">
                                <MethodBadge method={method} />
                                <span className="text-sm text-text-muted">
                                    {operation.summary}
                                </span>
                            </div>
                        )}

                        {operation.description && (
                            <p className="text-sm leading-relaxed text-text-muted">
                                {operation.description}
                            </p>
                        )}

                        <ParametersTable parameters={operation.parameters} />
                        <RequestBody
                            requestBody={operation.requestBody}
                            schemas={schemas}
                        />
                        <Responses responses={operation.responses} schemas={schemas} />
                    </section>
                ))}
            </div>
        </details>
    );
}
