'use client';

import MermaidDiagram from '@/shared/components/MermaidDiagram/MermaidDiagram';
import { DEFINITION } from './notificationFlowDefinition';
import { notificationFlowConfig } from './notificationFlowConfig';

export default function NotificationFlowDiagram() {
    return (
        <MermaidDiagram
            id="notification-flow"
            definition={DEFINITION}
            config={notificationFlowConfig}
        />
    );
}
