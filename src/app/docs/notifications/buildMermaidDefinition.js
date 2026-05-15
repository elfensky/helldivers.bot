export function buildMermaidDefinition(body) {
    return {
        DEFINITION_LR: `graph LR\n${body}`,
        DEFINITION_TD: `graph TD\n${body}`,
    };
}
