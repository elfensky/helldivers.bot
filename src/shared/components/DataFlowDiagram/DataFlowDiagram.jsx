'use client';

import MermaidDiagram from '@/shared/components/MermaidDiagram/MermaidDiagram';
import { DEFINITION } from './dataFlowDefinition';
import { dataFlowConfig } from './dataFlowConfig';

export default function DataFlowDiagram() {
    return (
        <MermaidDiagram id="data-flow" definition={DEFINITION} config={dataFlowConfig} />
    );
}
