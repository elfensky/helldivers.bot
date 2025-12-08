'use server';
import { performanceTime } from '@/utils/time';
import { tryCatch } from '@/utils/tryCatch';

async function getPrismaProvider() {
    'use server';
    //technically I do not need this, as I only support PostGresSQL, and have no plans to support other databases. But I wrote it, so might as well keep it.
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
            throw new Error('Could not extract the provider from schema.prisma');
        }
    } else {
        throw new Error('Only the Node.js runtime is supported', {
            cause: '/src/utils/initialize.prisma.mjs | getPrismaProvider()',
        });
    }
}

async function runMigrations() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // dynamic imports
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const { performance } = await import('perf_hooks');

        //init
        const start = performance.now();
        const execAsync = promisify(exec);

        try {
            const { stdout, stderr } = await execAsync(`npx prisma migrate deploy`);

            const harmlessStderr = ['Environment variables loaded from .env'];

            if (stderr && !harmlessStderr.some((msg) => stderr.trim().startsWith(msg))) {
                throw new Error(stderr);
            }

            const cleanedStdout = stdout.replace(/(\r?\n){3,}/g, '\n');
            // console.log('\n' + cleanedStdout);
            // console.log(
            //     `DATABASE - finished migrations in ' + ${performanceTime(start)} ms`,
            // );
            return true;
        } catch (error) {
            // console.error('bla', error);
            throw error;
        }
    } else {
        throw new Error('Only the Node.js runtime is supported', {
            cause: '/src/utils/initialize.prisma.mjs | getPrismaProvider()',
        });
        // return false;
    }
}

export async function initializeDatabase() {
    'use server';
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        //1. get the provider type
        const { data: provider, error: proErr } = await tryCatch(getPrismaProvider());
        if (proErr) {
            console.error(providerError.message, {
                cause: '/src/utils/initialize.prisma.mjs | await tryCatch(getPrismaProvider())',
            });
            process.exit(1);
        }

        //2. run migrations
        if (provider === 'postgresql') {
            //test if database exists and create it if not
            const { data: migrations, error: migErr } = await tryCatch(runMigrations());
            if (migErr) {
                console.error(migErr.message, {
                    cause: '/src/utils/initialize.prisma.mjs | await tryCatch(runMigrations())',
                });
                process.exit(1);
            }
            return true;
        } else {
            // console.error('DATABASE - only postgresql is supported', {});
            return false;
        }
    } else {
        return false;
    }
}
