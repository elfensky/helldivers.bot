export function useMDXComponents(components) {
    return {
        h1: ({ children }) => (
            <h1 className="font-display text-3xl text-primary">{children}</h1>
        ),
        h2: ({ children }) => (
            <h2 className="mt-8 mb-4 font-display text-xl text-text">{children}</h2>
        ),
        h3: ({ children }) => (
            <h3 className="mt-6 mb-2 font-display text-lg text-text">{children}</h3>
        ),
        p: ({ children }) => <p className="mb-4 leading-[1.7] text-text">{children}</p>,
        a: ({ children, href }) => (
            <a
                href={href}
                className="text-primary underline decoration-primary/30 hover:decoration-primary"
            >
                {children}
            </a>
        ),
        code: ({ children }) => (
            <code className="bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-text">
                {children}
            </code>
        ),
        pre: ({ children }) => (
            <pre className="mb-4 overflow-x-auto bg-surface-1 p-4 font-mono text-sm leading-relaxed text-text">
                {children}
            </pre>
        ),
        table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">{children}</table>
            </div>
        ),
        th: ({ children }) => (
            <th className="border border-outline-variant bg-surface-1 px-3 py-2 text-left font-semibold text-text">
                {children}
            </th>
        ),
        td: ({ children }) => (
            <td className="border border-outline-variant px-3 py-2 text-text-muted">
                {children}
            </td>
        ),
        ul: ({ children }) => (
            <ul className="mb-4 list-disc pl-6 text-text">{children}</ul>
        ),
        ol: ({ children }) => (
            <ol className="mb-4 list-decimal pl-6 text-text">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-1 leading-[1.7]">{children}</li>,
        blockquote: ({ children }) => (
            <blockquote className="mb-4 border-l-2 border-primary pl-4 text-text-muted italic">
                {children}
            </blockquote>
        ),
        hr: () => <hr className="my-8 border-outline-variant" />,
        ...components,
    };
}
