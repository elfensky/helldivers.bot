import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The retired-claim sweeps from 02-DOCS-PAGE-CHECK.md § Final check. Their
// regexes must match 0 lines on the docs pages. DOCS-03 may rewrite these
// pages, so update the list here when a claim is rewritten, not the regex.
// Sweep 3 holds the claims that the phase verification found
// (02-VERIFICATION.md) and grows per gap-closure plan.

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

const PAGE_DIRS = [
    'src/app/docs/architecture',
    'src/app/docs/data-flow',
    'src/app/docs/infrastructure',
    'src/app/docs/database',
    'src/app/docs/testing',
    'src/app/docs/notifications',
];
const PAGE_FILES = [
    'src/app/docs/page.mdx',
    'src/app/docs/overviewConfig.mjs',
    'src/app/docs/overviewDefinition.mjs',
];

function filesUnder(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) filesUnder(full, out);
        else out.push(full);
    }
    return out;
}

const PAGES = [
    ...PAGE_DIRS.flatMap((d) => filesUnder(path.join(REPO, d))),
    ...PAGE_FILES.map((f) => path.join(REPO, f)),
];

function hits(pattern) {
    return PAGES.flatMap((file) =>
        readFileSync(file, 'utf8')
            .split('\n')
            .map((text, i) => ({ text, line: i + 1 }))
            .filter(({ text }) => pattern.test(text))
            .map(
                ({ line, text }) =>
                    `${path.relative(REPO, file)}:${line}: ${text.trim()}`,
            ),
    );
}

describe('docs pages carry no retired claims (Final check sweeps)', () => {
    it('sweep 1: retired names, paths and values', () => {
        const pattern =
            /TIMESTAMPTZ|initializeOpenApiSpec|\?key=|staging\.docker\.yml|release\.docker\.yml|metrics\.yml|[^-a-z]ci\.yml|euraika|aegis|POSTGRES_SSL|SKIP_MIGRATIONS|5-15 seconds|silent: true|snapshot throttling|AI assistants|distroless|uid 1001|RELEASE\.md|softprops|prisma db seed/;
        expect(hits(pattern)).toEqual([]);
    });

    it('sweep 2: fixed-interval and in-memory state claims', () => {
        expect(hits(/~15 ?s|every ~15|in memory/)).toEqual([]);
    });

    it('sweep 3: claims retired by the gap closure (plans 02-16 to 02-18)', () => {
        const g1 = 'explicit client approval|pwa--offline';
        const g2 =
            "season_duration\\[\\]|upsert by event_id|\\(event_id, bucket\\)|'bucket', 'DateTime'|\\(app\\)\\/page\\.jsx|worker --> hd1";
        const g3 =
            'hd1_api --> worker|Thread that polls|default 20s|worker polls less frequently|src\\/app\\/site\\.webmanifest';
        const g4 = 'cannot pin a build without its maps';
        expect(hits(new RegExp(`${g1}|${g2}|${g3}|${g4}`))).toEqual([]);
    });
});
