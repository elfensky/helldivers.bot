import { describe, it, expect } from 'vitest';
import { createFlowConfig, buildMermaidDefinition } from '@/app/docs/_diagram.mjs';

describe('createFlowConfig', () => {
    it('returns config with all required keys', () => {
        const config = createFlowConfig({
            views: [{ key: 'all', label: 'All' }],
            legend: [{ color: '#fff', label: 'Test' }],
            title: 'Test Diagram',
            description: 'A test diagram',
            details: { node: { title: 'Node', sections: [] } },
        });

        expect(config).toEqual({
            views: [{ key: 'all', label: 'All' }],
            flows: {},
            legend: [{ color: '#fff', label: 'Test' }],
            title: 'Test Diagram',
            description: 'A test diagram',
            details: { node: { title: 'Node', sections: [] } },
        });
    });

    it('defaults flows to empty object', () => {
        const config = createFlowConfig({
            views: [],
            legend: [],
            title: '',
            description: '',
            details: {},
        });
        expect(config.flows).toEqual({});
    });

    it('preserves explicit flows', () => {
        const flows = { live: ['a', 'b'] };
        const config = createFlowConfig({
            views: [],
            flows,
            legend: [],
            title: '',
            description: '',
            details: {},
        });
        expect(config.flows).toEqual(flows);
    });
});

describe('buildMermaidDefinition', () => {
    it('wraps body with graph LR and graph TD prefixes', () => {
        const body = '    A --> B';
        const { DEFINITION_LR, DEFINITION_TD } = buildMermaidDefinition(body);

        expect(DEFINITION_LR).toBe('graph LR\n    A --> B');
        expect(DEFINITION_TD).toBe('graph TD\n    A --> B');
    });
});
