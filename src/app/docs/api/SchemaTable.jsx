/**
 * Server component that renders an OpenAPI schema as a property table.
 * Recursively handles nested objects and resolves $ref references.
 */

function resolveRef(schema, schemas) {
    if (schema?.$ref) {
        const name = schema.$ref.replace('#/components/schemas/', '');
        return { resolved: schemas?.[name] ?? schema, refName: name };
    }
    return { resolved: schema, refName: null };
}

function getTypeLabel(prop) {
    if (prop.enum) return prop.enum.map((v) => `"${v}"`).join(' | ');
    if (prop.type === 'object' && prop.properties) return 'object';
    if (prop.type === 'array') return 'array';
    return prop.type ?? 'any';
}

export default function SchemaTable({ schema, schemas, depth = 0 }) {
    if (!schema) return null;

    const { resolved } = resolveRef(schema, schemas);
    const properties = resolved?.properties;
    if (!properties) {
        // Simple type (string, number, etc.) — show inline
        const label = getTypeLabel(resolved);
        if (label === 'any') return null;
        return <span className="font-mono text-xs text-text-muted">{label}</span>;
    }

    const required = resolved.required ?? [];

    return (
        <table className="mt-2 w-full text-sm">
            <thead>
                <tr className="border-b border-ghost text-left text-xs tracking-wide text-text-muted uppercase">
                    <th className="py-1.5 pr-3 font-semibold">Property</th>
                    <th className="py-1.5 pr-3 font-semibold">Type</th>
                    <th className="py-1.5 pr-3 font-semibold">Required</th>
                    <th className="py-1.5 font-semibold">Description</th>
                </tr>
            </thead>
            <tbody>
                {Object.entries(properties).map(([name, prop]) => {
                    const { resolved: resolvedProp, refName } = resolveRef(prop, schemas);
                    const isRequired = required.includes(name);
                    const hasNested =
                        resolvedProp?.type === 'object' && resolvedProp?.properties;

                    return (
                        <tr key={name} className="border-b border-ghost/50">
                            <td className="py-1.5 pr-3 align-top">
                                <code
                                    className="font-mono text-xs text-text"
                                    style={{
                                        paddingLeft: `${depth * 12}px`,
                                    }}
                                >
                                    {name}
                                </code>
                            </td>
                            <td className="py-1.5 pr-3 align-top font-mono text-xs text-text-muted">
                                {refName ?
                                    <span title={`$ref: ${refName}`}>{refName}</span>
                                :   getTypeLabel(resolvedProp)}
                            </td>
                            <td className="py-1.5 pr-3 align-top text-xs">
                                {isRequired ?
                                    <span className="text-primary">yes</span>
                                :   <span className="text-text-muted">no</span>}
                            </td>
                            <td className="py-1.5 align-top text-xs text-text-muted">
                                {resolvedProp?.description ?? ''}
                                {hasNested && (
                                    <SchemaTable
                                        schema={resolvedProp}
                                        schemas={schemas}
                                        depth={depth + 1}
                                    />
                                )}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
