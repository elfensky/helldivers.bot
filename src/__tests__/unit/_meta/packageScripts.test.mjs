import { readFileSync } from 'node:fs';

function readPackageJson() {
    const packageJsonPath = new URL('../../../../package.json', import.meta.url);
    return JSON.parse(readFileSync(packageJsonPath, 'utf8'));
}

test('exposes test:e2e as a compatibility alias for smoke tests', () => {
    const packageJson = readPackageJson();

    expect(packageJson.scripts['test:smoke']).toBeDefined();
    expect(packageJson.scripts['test:e2e']).toBe(packageJson.scripts['test:smoke']);
});
