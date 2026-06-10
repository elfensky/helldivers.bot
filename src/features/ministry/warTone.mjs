import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';

/**
 * Derive overall war tone from completed-season outcomes.
 *
 * A "completed" war is one where getWarOutcome returned a definitive
 * 'victory' or 'defeat' classification (NOT 'unknown'). The existing
 * `getCrossSeasonStats` already does the per-season getWarOutcome run
 * and is wrapped in React `cache()` — so calling this from layout.jsx
 * costs nothing extra per request once getCrossSeasonStats has been
 * called.
 *
 * @returns {Promise<'winning' | 'losing' | null>}
 *   `null` disables the Ministry Interference effect entirely. We
 *   return null on DB failures and on the "no completed wars yet"
 *   case rather than forcing a tone — silently injecting wrong
 *   content during operational failures would be worse than nothing.
 */
export async function getWarTone() {
    const { data, error } = await tryCatch(getCrossSeasonStats());
    if (error || !data) return null;

    const completed = data.perSeason.filter(
        (s) => s.outcome === 'victory' || s.outcome === 'defeat',
    );
    if (completed.length === 0) return null;

    const wonCount = completed.filter((s) => s.outcome === 'victory').length;
    return wonCount / completed.length >= 0.5 ? 'winning' : 'losing';
}
