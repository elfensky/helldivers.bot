import { performanceTime } from '@/utils/time';
import { tryCatch } from '@/lib/tryCatch';

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
            throw new Error('Could not find the provider in datasource db block');
        }
    } else {
        return false;
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

        // console.log('DATABASE - starting migrations...');

        try {
            const { stdout, stderr } = await execAsync(`npx prisma migrate deploy`);
            if (stderr) {
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
        return false;
    }
}

export async function initializeDatabase() {
    'use server';
    // console.log('initializeDatabase() start');
    const provider = await getPrismaProvider();
    // console.log('initializeDatabase() | provider: ', provider);

    if (provider === 'postgresql') {
        //test if database exists and create it if not
        const { data, error } = await tryCatch(runMigrations());
        // console.log(data);
        // console.log(error);
        return true;
    }

    return false;
}
