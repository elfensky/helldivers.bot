export function createFlowConfig({
    views,
    flows = {},
    legend,
    title,
    description,
    details,
}) {
    return { views, flows, legend, title, description, details };
}

export function buildMermaidDefinition(body) {
    return {
        DEFINITION_LR: `graph LR\n${body}`,
        DEFINITION_TD: `graph TD\n${body}`,
    };
}
