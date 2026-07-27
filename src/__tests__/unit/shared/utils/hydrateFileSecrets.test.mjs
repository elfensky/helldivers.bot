import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hydrateFileSecrets } from '@/shared/utils/hydrateFileSecrets.mjs';

// Keys this suite touches — snapshot and restore so tests don't leak into each other.
const KEYS = ['HFS_SECRET', 'HFS_SECRET_FILE', 'HFS_EMPTY', 'HFS_EMPTY_FILE'];

describe('hydrateFileSecrets', () => {
    /** @type {string} */
    let dir;
    /** @type {Record<string, string | undefined>} */
    let saved;

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'hfs-'));
        saved = {};
        for (const k of KEYS) {
            saved[k] = process.env[k];
            delete process.env[k];
        }
    });

    afterEach(() => {
        for (const k of KEYS) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
        rmSync(dir, { recursive: true, force: true });
    });

    it('populates <KEY> from <KEY>_FILE and trims trailing whitespace', () => {
        const file = join(dir, 'secret');
        writeFileSync(file, 'super-secret-value\n');
        process.env.HFS_SECRET_FILE = file;

        const populated = hydrateFileSecrets();

        expect(process.env.HFS_SECRET).toBe('super-secret-value');
        expect(populated).toContain('HFS_SECRET');
    });

    it('does not override a directly-set env var (direct wins)', () => {
        const file = join(dir, 'secret');
        writeFileSync(file, 'from-file');
        process.env.HFS_SECRET = 'from-env';
        process.env.HFS_SECRET_FILE = file;

        const populated = hydrateFileSecrets();

        expect(process.env.HFS_SECRET).toBe('from-env');
        expect(populated).not.toContain('HFS_SECRET');
    });

    it('warns and skips when the file is missing, leaving the var unset', () => {
        process.env.HFS_SECRET_FILE = join(dir, 'does-not-exist');

        const populated = hydrateFileSecrets();

        expect(process.env.HFS_SECRET).toBeUndefined();
        expect(populated).not.toContain('HFS_SECRET');
    });

    it('leaves the var unset for an empty file', () => {
        const file = join(dir, 'empty');
        writeFileSync(file, '   \n');
        process.env.HFS_EMPTY_FILE = file;

        hydrateFileSecrets();

        expect(process.env.HFS_EMPTY).toBeUndefined();
    });

    it('ignores env vars that do not end in _FILE', () => {
        process.env.HFS_SECRET = 'plain';
        const populated = hydrateFileSecrets();
        expect(populated).not.toContain('HFS_SECRET');
        expect(process.env.HFS_SECRET).toBe('plain');
    });
});
