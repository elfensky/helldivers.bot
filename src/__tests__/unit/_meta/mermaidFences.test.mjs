import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The script runs in a child process so its jsdom globals stay out of vitest.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('docs mermaid fences parse (scripts/check-mermaid-fences.mjs)', () => {
    it('every fence in the default docs pages parses and at least one is checked', () => {
        const run = spawnSync(process.execPath, ['scripts/check-mermaid-fences.mjs'], {
            cwd: REPO,
            encoding: 'utf8',
            timeout: 120000,
        });

        expect(run.stdout, run.stderr).toMatch(/checked (\d+) fences/);
        const checked = Number(run.stdout.match(/checked (\d+) fences/)[1]);
        expect(checked).toBeGreaterThanOrEqual(1);
        expect(run.stdout).not.toMatch(/^FAIL /m);
        expect(run.status, run.stdout + run.stderr).toBe(0);
    }, 120000);
});
