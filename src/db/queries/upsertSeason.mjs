import { z } from 'zod/v4';
import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export function query_upsert_status(data) {
    'use server';
    console.log('store_rebroadcast_status', data);
}

export function query_upsert_snapshot(data) {
    'use server';
    console.log('store_rebroadcast_snapshot', data);
}
