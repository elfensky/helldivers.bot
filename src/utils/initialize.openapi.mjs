import { performanceTime } from '@/utils/time';

async function generateOpenApiSpec() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
        //imports
        const fs = await import('fs/promises');
        const swaggerJSDoc = await import('swagger-jsdoc');
        const { performance } = await import('perf_hooks');

        //initialize
        const start = performance.now();
        const apisPattern = './src/app/api/h1/**/*.js';
        const swaggerOptions = {
            definition: {
                openapi: '3.0.0',
                info: {
                    title: 'Helldivers 1 API',
                    version: '0.4.1',
                    description: 'A simple API',
                },
            },
            apis: [apisPattern],
        };

        //generate
        const swaggerSpec = swaggerJSDoc(swaggerOptions);
        const filePath = 'public/openapi.json';

        await fs.writeFile(filePath, JSON.stringify(swaggerSpec, null, 2), 'utf-8');
        const file = await fs.readFile(filePath, 'utf-8');

        //check file
        if (!file) {
            return false;
        }

        //check contents
        try {
            JSON.parse(file);
            return true;
        } catch (error) {
            return false;
        }

        return false;
    } else {
        console.error('generateOpenApiSpec()');
    }
}

async function checkOpenApiSpec() {
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
        //imports
        const fs = await import('fs/promises');
        const { performance } = await import('perf_hooks');

        //initialize
        const start = performance.now();
        const filePath = 'public/openapi.json';

        //check file
        const file = await fs.readFile(filePath, 'utf-8');
        if (!file) {
            return false;
        }

        //check contents
        try {
            JSON.parse(file);
            return true;
        } catch (error) {
            return false;
        }
    } else {
        console.error('checkOpenApiSpec()');
    }
}

export async function initializeOpenApiSpec() {
    //swagger uses JSDoc comments to generate the OpenAPI spec, so it's only possible to generate it during development.
    //the production build will not have the JSDoc comments available, as it strips out all unneccesary code and contents.
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
        return await generateOpenApiSpec();
    }

    //during production, the OpenAPI spec is already generated and stored in the public/openapi.json file.
    //we simply need to check if it's present and valid JSON.
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'production') {
        return await checkOpenApiSpec();
    }

    return false;
}
