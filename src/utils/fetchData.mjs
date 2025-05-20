//fetch
import axios from 'axios';
import https from 'https';

export async function fetchData(url, formData) {
    const agent = new https.Agent({
        rejectUnauthorized: false, // disables SSL certificate validation
    });

    try {
        const response = await axios.post(url, formData, {
            httpsAgent: agent,
        });

        //todo: instead of this, use zod to properly fully validate the response.
        if (!response.data) {
            throw new Error('No data received from the API', {
                cause: 'fetchData()',
            });
        }
        return response.data;
    } catch (error) {
        throw new Error('Failed to fetch data from axios', {
            cause: 'fetchData()',
        });
    }
}
