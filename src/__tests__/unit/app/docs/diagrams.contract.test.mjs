// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import mermaid from 'mermaid';
import * as dataFlow from '@/app/docs/architecture/dataFlowDefinition.mjs';
import { dataFlowConfig } from '@/app/docs/architecture/dataFlowConfig.mjs';
import * as overview from '@/app/docs/overviewDefinition.mjs';
import { overviewConfig } from '@/app/docs/overviewConfig.mjs';
import * as notification from '@/app/docs/notifications/notificationFlowDefinition.mjs';
import { notificationFlowConfig } from '@/app/docs/notifications/notificationFlowConfig.mjs';
import * as inApp from '@/app/docs/notifications/inAppFlowDefinition.mjs';
import { inAppFlowConfig } from '@/app/docs/notifications/inAppFlowConfig.mjs';
import * as push from '@/app/docs/notifications/pushFlowDefinition.mjs';
import { pushFlowConfig } from '@/app/docs/notifications/pushFlowConfig.mjs';

const DIAGRAMS = [
    { name: 'data flow', definition: dataFlow, config: dataFlowConfig },
    { name: 'overview', definition: overview, config: overviewConfig },
    {
        name: 'notification flow',
        definition: notification,
        config: notificationFlowConfig,
    },
    { name: 'in-app flow', definition: inApp, config: inAppFlowConfig },
    { name: 'push flow', definition: push, config: pushFlowConfig },
];

// Mermaid node ids appear at the start of a line or after a separator, followed by a shape bracket.
function declaresNode(source, id) {
    return new RegExp(`(^|[\\s;])${id}[\\[({>]`, 'm').test(source);
}

describe.each(DIAGRAMS)('rendered $name diagram', ({ definition, config }) => {
    it.each([
        ['DEFINITION_LR', 'LR'],
        ['DEFINITION_TD', 'TD'],
    ])('%s parses as a flowchart', async (exportName) => {
        const source = definition[exportName];
        const parsed = await mermaid.parse(source);

        expect(parsed.diagramType).toMatch(/flow/);
    });

    it.each([
        ['DEFINITION_LR', 'LR'],
        ['DEFINITION_TD', 'TD'],
    ])('every details node is declared in %s', (exportName) => {
        const source = definition[exportName];
        const missing = Object.keys(config.details).filter(
            (id) => !declaresNode(source, id),
        );

        expect(missing).toEqual([]);
    });
});
