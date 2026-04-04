import { generateOpenApiSpec as generateSpec } from '@/utils/openapi.registry';

function safeJsonParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

async function generateOpenApiSpec() {
    const fs = await import('fs/promises');

    const swaggerSpec = generateSpec();
    const filePath = 'public/openapi.json';

    await fs.writeFile(filePath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');
    const file = await fs.readFile(filePath, 'utf-8');

    if (!file) return false;
    return safeJsonParse(file) !== null;
}

async function checkOpenApiSpec() {
    const fs = await import('fs/promises');
    const filePath = 'public/openapi.json';

    const file = await fs.readFile(filePath, 'utf-8');
    if (!file) return false;
    return safeJsonParse(file) !== null;
}

export async function initializeOpenApiSpec() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return false;

    // Swagger uses JSDoc comments to generate the OpenAPI spec, so it's only possible
    // to generate it during development. Production strips JSDoc, so we just validate
    // the pre-built file.
    if (process.env.NODE_ENV === 'development') {
        return await generateOpenApiSpec();
    }

    if (process.env.NODE_ENV === 'production') {
        return await checkOpenApiSpec();
    }

    return false;
}
