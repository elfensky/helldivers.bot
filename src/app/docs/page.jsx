import fs from 'fs';
import path from 'path';

import DocsClient from '@/components/layout2/openapi/DocsClient';

export default function DocsPage() {
    const filePath = path.join(process.cwd(), 'public', 'openapi.json');
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const openapi = JSON.parse(jsonData);

    return <DocsClient spec={openapi} />;
}
