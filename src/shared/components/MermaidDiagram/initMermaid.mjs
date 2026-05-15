let initialized = false;

export async function ensureMermaidInit() {
    if (initialized) return;
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
        startOnLoad: false,
        // 'loose' enables HTML labels (<br/>, <small>) in node text.
        // Safe here: all definitions are static source code, never user-supplied.
        securityLevel: 'loose',
        theme: 'base',
        themeVariables: {
            darkMode: true,
            background: '#131313',
            primaryColor: '#1c1b1b',
            primaryBorderColor: '#2a2a2a',
            primaryTextColor: 'hsl(0, 0%, 80%)',
            lineColor: '#6b7280',
            fontFamily: 'Inter, Arial, sans-serif',
            fontSize: '13px',
        },
        flowchart: {
            useMaxWidth: true,
            curve: 'basis',
            htmlLabels: true,
        },
    });
    initialized = true;
}
