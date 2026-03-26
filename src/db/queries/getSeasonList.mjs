'use server';
import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';

export async function getSeasonList() {
    const { data, error } = await tryCatch(
        db.h1_season.findMany({
            select: {
                season: true,
                last_updated: true,
            },
            orderBy: { season: 'desc' },
        }),
    );

    if (error) throw error;

    return data;
}
