import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function listTypecheckedFiles() {
    const repoRoot = path.resolve(import.meta.dirname, '../../../..');
    const tscPath = fileURLToPath(
        new URL('../../../../node_modules/typescript/bin/tsc', import.meta.url),
    );
    const output = execFileSync(
        process.execPath,
        [tscPath, '-p', 'jsconfig.json', '--listFilesOnly'],
        {
            cwd: repoRoot,
            encoding: 'utf8',
        },
    );

    return output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

test('typecheck includes app source files and excludes unit tests', () => {
    const files = listTypecheckedFiles();

    expect(
        files.some((file) =>
            file.endsWith(path.join('src', 'shared', 'utils', 'time.mjs')),
        ),
    ).toBe(true);
    expect(
        files.some((file) =>
            file.endsWith(
                path.join('src', '__tests__', 'unit', '_meta', 'packageScripts.test.mjs'),
            ),
        ),
    ).toBe(false);
}, 15_000);
