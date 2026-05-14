import axios from 'axios';
import https from 'https';
import { isValidNumber } from '@/validators/isValidNumber';
import { tryCatch } from '@/shared/utils/tryCatch';

const HD1_API_URL = 'https://api.helldiversgame.com/1.0/';

async function fetchWithUntrustedCert(url, formData) {
    const agent = new https.Agent({
        rejectUnauthorized: false, // disables SSL certificate validation
    });

    const { data: response, error } = await tryCatch(
        axios.post(url, formData, { httpsAgent: agent }),
    );

    if (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(
                `Axios error: ${error.response?.status} ${error.response?.statusText || ''} - ${error.message}`,
                { cause: '/src/update/fetch.mjs | fetchWithUntrustedCert()' },
            );
        }
        throw new Error('Failed to fetch data from axios', {
            cause: '/src/update/fetch.mjs | fetchWithUntrustedCert()',
        });
    }

    if (!response.data) {
        throw new Error('No data received from the API', {
            cause: '/src/update/fetch.mjs | fetchWithUntrustedCert()',
        });
    }

    return response.data;
}

export async function fetchStatus() {
    const url = HD1_API_URL;
    const form = new FormData();
    form.append('action', 'get_campaign_status');
    return fetchWithUntrustedCert(url, form);
}

export async function fetchSeason(season) {
    if (!isValidNumber.safeParse(season).success) throw new Error('Invalid season');

    const url = HD1_API_URL;
    const form = new FormData();
    form.append('action', 'get_snapshots');
    form.append('season', season.toString());
    return fetchWithUntrustedCert(url, form);
}
