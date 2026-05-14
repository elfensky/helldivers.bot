import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { errorResponse } from '@/shared/utils/api/responses';
import { methodNotAllowed } from '@/shared/utils/api/methodNotAllowed';
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/shared/utils/game/computeMapState';
import { EVENT_STATUS } from '@/shared/enums/events';

export async function GET() {
    const start = performance.now();

    const { data, error } = await tryCatch(getCampaign());
    if (error || !data) {
        return errorResponse(500, start, error?.message ?? 'No campaign data');
    }

    const activeEvents = (data.events ?? []).filter(
        (e) => e.status === EVENT_STATUS.ACTIVE,
    );
    const mapState = computeMapState(data.status, activeEvents);

    const json = JSON.stringify(
        { data, mapState, appVersion: process.env.NEXT_PUBLIC_APP_VERSION },
        (_, v) => (typeof v === 'bigint' ? Number(v) : v),
    );

    return new Response(json, {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
        },
    });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const OPTIONS = methodNotAllowed;
