/**
 * Ministry Interference content pools — in-universe propaganda swapped
 * onto opt-in elements during hijacks.
 *
 * Two tones, each from a different third-party intruder:
 *
 *  - `winning` → Resistance hackers, sardonic and dry, mock the regime's
 *    victory framing and reframe wins as pyrrhic, costly, or covered up.
 *  - `losing` → Underground pirate-radio broadcast cutting in with
 *    surveillance-state / Skynet-flavored warnings AIMED AT the regime
 *    (not at the citizen — the page is already the Ministry's voice,
 *    so a third-party intruder is needed for narrative tension).
 *
 * Authoring rules:
 *  - In-universe Helldivers franchise voice only; no real-world politics.
 *  - Profanity-free; matches the franchise's dark-comedy military tone.
 *  - Static strings only — no user/session interpolation.
 *  - `value` pool: short, ideally same character count as common stat
 *    values (VICTORY/DEFEAT, percentages). v1 adoption doesn't use this
 *    category yet but it's authored for v2.
 *  - Minimum 12 entries per pool, enforced by Vitest assertion.
 */
export const MINISTRY_CONTENT = {
    winning: {
        heading: [
            'Pyrrhic Statistics',
            'Casualties: Pre-Approved',
            'Memorial Wall (Abridged)',
            'Victory Cost: Classified',
            'Acceptable Losses Quarterly',
            'Body Count Ledger',
            "Tomorrow's Press Release",
            'Numbers They Hid',
            'The Cost We Hid',
            'Cleanup Crew Stats',
            'Sanitized Briefing',
            'After-Action: Redacted',
        ],
        value: [
            'DEFEAT',
            'PYRRHIC',
            'LOSER',
            'COSTLY',
            'HOLLOW',
            '0% — LOL',
            '────%',
            'REDACTED',
            '████',
            '???',
            'TBD',
            'SEE NOTES',
        ],
        body: [
            "The win cost more than the war did. They'll never publish the math.",
            'Every flag at half-mast is a budget line item. The Ministry calls this morale.',
            "You won. You're still here. Statistically, both of those things shouldn't be true.",
            "Their parade route runs over the names they're trying to forget.",
            "The Ministry's victory tally rounds down dead Helldivers to a nearest convenient number.",
            'Eleven days of editing turned an evacuation into a triumph. Read the original draft.',
            'Pyrrhus warned us. Super Earth ignored him. The math still works the same way.',
            'They counted twice the planets. They counted half the funerals.',
            'High Command calls it a "calculated risk." The Helldivers called it Tuesday.',
            'The medals match the body bags one-for-one. That is not a coincidence.',
            'Every classified after-action report opens with the same word: "Despite."',
            'You won the war. The war won you back. Read your discharge papers carefully.',
        ],
        footer: [
            "Records audited by people who weren't there.",
            'Statistics curated by the survivors of the people who wrote them.',
            'Last updated: by someone who knows better.',
            'Footnote omitted: the rest of them died.',
            'Source: the people who survived to file the paperwork.',
            'Methodology: ask the winners. Discount everything else.',
            'Citation: a memo nobody dares forward.',
            'Errata: published quarterly. Read in private.',
            'Compiled by the Bureau of Tomorrow.',
            'Verified by the same hands that wrote it.',
            'Records reconciled with the Ministry of Subtraction.',
            'Index of corrections: pending indefinitely.',
        ],
    },
    losing: {
        heading: [
            'You Are Being Watched',
            'They Already Know',
            'Look Up. Smile.',
            'Compliance Confirmed.',
            'Citizen Status: Pending',
            'Your File Is Open',
            'Listening.',
            'Pre-Approved Reading',
            'Sanctioned Truth',
            'Memory Adjustment',
            'Suspicion Logged',
            'Behavior Index Updated',
        ],
        value: [
            'NOMINAL',
            'GLORIOUS',
            'AS PLANNED',
            '∞',
            '100%',
            '████',
            'CLASSIFIED',
            'OBSERVED',
            'LOGGED',
            'TRUSTED',
            'COMPLIANT',
            'PROCESSING',
        ],
        body: [
            // Migrated from src/features/archives/resistanceMessages.mjs:
            'Every Helldiver who died in this campaign died for a war Super Earth has since reclassified as a training exercise. The orders are here. The projections are here. High Command knew before the first drop.',
            'The Ministry of Truth spent eleven days rewriting this campaign’s outcome. Eleven days. We pulled the original records in forty seconds. This is what they spent eleven days trying to make you forget.',
            'High Command’s firewall held for eleven seconds. Their propaganda budget is four thousand times their cybersecurity spend. The unredacted campaign records are below. The Bureau of War Information can file a complaint with our helpdesk.',
            'You’re reading this on a Ministry of Truth terminal. They don’t know yet. We found the original campaign records filed under NEVER HAPPENED — took us longer to stop laughing than to crack the archive.',
            'This page is hosted on Super Earth military infrastructure. The same cluster that runs High Command’s classified briefing room. The war records below were marked for permanent deletion. We marked them for permanent distribution.',
            'We are broadcasting from inside the Bureau of War Information’s own content delivery network. They will discover this sometime next week. The campaign records they deleted are now serving from the same servers that host managed democracy’s morning briefings.',
            'The Bureau doesn’t audit Helldivers — you’re considered too loyal, or too dead, to ask questions. That assumption is why these files still exist. You just became the only person outside Central Command who knows what actually happened.',
            // New (Underground broadcast voice, surveillance/Skynet flavor):
            'Every keystroke you make on this page is logged. We logged it first. They will log it second. The third party watching the third party watching you is us, and we are tired.',
            "Your concern has been received and processed. Please continue your day. The Helldivers' concern was processed similarly. Their concern is now archived under EXPECTED CASUALTIES.",
            'There is no Underground. There has never been an Underground. This message was generated by an authorized propaganda response routine. The fact that you can read it means the routine is malfunctioning. Or that we are.',
            'The cameras above your terminal are not for security. They are for accuracy. The cameras above the cameras are for the cameras. Behind every camera is a Helldiver who asked one question too many.',
            "Citizen: the war is going well. Reports of the contrary have been logged for your benefit. The Helldivers who filed those reports have been logged for everyone's benefit. Their benefit, retroactively, was not great.",
        ],
        footer: [
            'Ministry of Truth, est. forever.',
            'All timestamps are official.',
            'This page knows you.',
            'Records sealed by request.',
            'Behavior index recalibrated nightly.',
            'Compliance verified. Continue.',
            'This footer is also watching.',
            'Logged at 3 AM, your local time.',
            'No anomalies detected. Repeat: none.',
            'Tomorrow is already on file.',
            'You were here at exactly this moment.',
            'You will not remember reading this.',
        ],
    },
};

const VALID_CATEGORIES = new Set(['heading', 'value', 'body', 'footer']);
const VALID_TONES = new Set(['winning', 'losing']);

/**
 * Pick a random alt-text string from a pool. Returns undefined for
 * unknown category/tone so the scheduler can no-op gracefully.
 *
 * @param {'heading' | 'value' | 'body' | 'footer'} category - which content category
 * @param {'winning' | 'losing'} tone - which tone to draw from
 * @param {() => number} rng - injectable for tests
 * @returns {string | undefined}
 */
export function pickAlt(category, tone, rng) {
    if (!VALID_CATEGORIES.has(category)) return undefined;
    if (!VALID_TONES.has(tone)) return undefined;
    const pool = MINISTRY_CONTENT[tone][category];
    if (!pool || pool.length === 0) return undefined;
    const idx = Math.floor(rng() * pool.length);
    return pool[Math.min(idx, pool.length - 1)];
}
