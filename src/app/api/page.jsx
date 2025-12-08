import fs from 'fs';
import path from 'path';
// import './swaggerDark.css';

import DocsClient from '@/components/layout/openapi/DocsClient';

export default function DocsPage() {
    const filePath = path.join(process.cwd(), 'public', 'openapi.json');
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    const openapi = JSON.parse(jsonData);

    return <DocsClient spec={openapi} />;
}
