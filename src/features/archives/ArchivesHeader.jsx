'use client';

import Hijackable from '@/features/ministry/Hijackable';

const TITLE = 'Declassified Campaign Archives';
const BODY =
    'Records verified by the Bureau of War Information. All outcomes reflect the supreme tactical genius of High Command. Unauthorized interpretation of campaign data is a Class-3 offense.';

/**
 * Archives page header. The previous defeat-only Cyberstan interference
 * effect was retired in favor of the sitewide Ministry Interference
 * system (see `src/features/ministry/`). Both the h1 and the body are
 * Hijackable — when picked, the new provider drives the glitch cycle.
 *
 * `scope="archives"` ensures these descriptors are only eligible for
 * hijacks while the user is actually on an archives page.
 */
export default function ArchivesHeader() {
    return (
        <div className="pb-2">
            <Hijackable
                as="h1"
                category="heading"
                scope="archives"
                text={TITLE}
                className="font-display text-body text-primary"
            />
            <Hijackable
                as="p"
                category="body"
                scope="archives"
                text={BODY}
                className="mt-1 max-w-screen-md text-small text-text-muted"
            />
        </div>
    );
}
