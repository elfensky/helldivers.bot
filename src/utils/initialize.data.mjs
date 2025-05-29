import update from '@/update/update.mjs';

export async function initializeData() {
    'use server';

    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
        return await update();
    }

    return false;
}
