import axios from 'axios';
import https from 'https';
import { isValidNumber } from '@/validators/isValidNumber';

function getApiURL() {
    switch (process.env.NODE_ENV) {
        case 'development':
            return 'https://api-qa.helldiversgame.com/sp-int/1.0/';
        case 'staging':
            return 'https://api-qa.helldiversgame.com/sp-int/1.0/';
        case 'production':
            return 'https://api.helldiversgame.com/1.0/';
        default:
            throw new Error('Unknown NODE_ENV');
    }
}

async function fetchInvalidHttps(url, formData) {
    const agent = new https.Agent({
        rejectUnauthorized: false, // disables SSL certificate validation
    });

    try {
        const response = await axios.post(url, formData, {
            httpsAgent: agent,
        });

        if (!response.data) {
            throw new Error('No data received from the API', {
                cause: '/src/update/fetch.mjs | fetchInvalidHttps()',
            });
        }
        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            // Axios-specific error handling
            throw new Error(
                `Axios error: ${error.response?.status} ${error.response?.statusText || ''} - ${error.message}`,
                { cause: '/src/update/fetch.mjs | fetchInvalidHttps()' },
            );
        } else {
            throw new Error('Failed to fetch data from axios', {
                cause: '/src/update/fetch.mjs | fetchInvalidHttps()',
            });
        }
    }
}

export async function fetchStatus() {
    const url = getApiURL();
    const form = new FormData();
    form.append('action', 'get_campaign_status');

    try {
        return await fetchInvalidHttps(url, form);
    } catch (error) {
        console.error(error.message);
        // throw error;
    }
}

export async function fetchSeason(season) {
    if (!isValidNumber.safeParse(season).success) throw new Error('Invalid season');

    const url = getApiURL();
    const form = new FormData();
    form.append('action', 'get_snapshots');
    form.append('season', season.toString());

    try {
        return await fetchInvalidHttps(url, form);
    } catch (error) {
        console.error(error.message);
        throw error;
    }
}
