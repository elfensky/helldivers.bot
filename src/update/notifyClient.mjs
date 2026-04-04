import pg from 'pg';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';

let client = null;

async function getClient() {
    if (client) return client;

    client = new pg.Client({
        connectionString: process.env.POSTGRES_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
    });

    const { error } = await tryCatch(client.connect());
    if (error) {
        console.error('NOTIFY client connection failed:', error.message);
        client = null;
        return null;
    }

    client.on('error', (err) => {
        console.error('NOTIFY client error:', err.message);
        client = null;
    });

    return client;
}

export async function notifyUpdate() {
    const conn = await getClient();
    if (!conn) return;

    const { error } = await tryCatch(conn.query('NOTIFY campaign_update'));
    if (error) {
        console.error('NOTIFY campaign_update failed:', error.message);
    }
}
