import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const exampleEnvPath = path.resolve(process.cwd(), '.example.env');

async function readExampleEnv() {
    return fs.readFile(exampleEnvPath, 'utf8');
}

describe('.example.env', () => {
    test('documents runtime env vars that are optional but still supported', async () => {
        const exampleEnv = await readExampleEnv();

        expect(exampleEnv).toContain('PORT="3000"');
        expect(exampleEnv).toContain('DEPLOY_ENV=""');
    });

    test('does not document removed database ssl toggle', async () => {
        const exampleEnv = await readExampleEnv();

        expect(exampleEnv).not.toContain('POSTGRES_SSL=');
    });
});
