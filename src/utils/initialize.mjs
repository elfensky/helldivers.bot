import { performanceTime } from '@/utils/time';

export async function getPrismaProvider() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        //dynamic imports
        const path = await import('path');
        const fs = await import('fs');
        const { fileURLToPath } = await import('url');
        const { performance } = await import('perf_hooks');

        // Convert import.meta.url to a file path
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);

        // Define the path to your schema.prisma file
        const schemaPath = path.join(__dirname, '..', '..', 'prisma', 'schema.prisma');

        // Read the contents of the schema.prisma file
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');

        // Find the datasource db block
        const datasourceDbMatch = schemaContent.match(/datasource\s+db\s*\{([\s\S]*?)\}/);
        if (!datasourceDbMatch) {
            throw new Error('Could not find datasource db block in schema.prisma');
        }
        // Extract the provider value from within the datasource db block
        const providerMatch = datasourceDbMatch[1].match(/provider\s*=\s*"([^"]+)"/);
        if (providerMatch && providerMatch[1]) {
            return providerMatch[1];
        } else {
            throw new Error('Could not find the provider in datasource db block');
        }
    } else {
        return false;
    }
}

export async function runMigrations() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // dynamic imports
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const { performance } = await import('perf_hooks');

        //init
        const start = performance.now();
        const execAsync = promisify(exec);

        console.log('DATABASE - starting migrations...');

        try {
            const { stdout, stderr } = await execAsync(`npx prisma migrate deploy`);
            if (stderr) {
                throw new Error(stderr);
            }

            const cleanedStdout = stdout.replace(/(\r?\n){3,}/g, '\n');
            console.log('\n' + cleanedStdout);
            console.log(
                `DATABASE - finished migrations in ' + ${performanceTime(start)} ms`,
            );
            return true;
        } catch (error) {
            // console.error('bla', error);
            throw error;
        }
    } else {
        return false;
    }
}

export async function generateOpenApiSpec() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
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

        const file = await fs.writeFile(
            'src/app/openapi/openapi.json',
            JSON.stringify(swaggerSpec, null, 2),
            'utf-8',
        );
        console.log('file', file);
        //save
        //store spec as json file
        if (file) {
            return true;
        }
    }

    return false;
}
