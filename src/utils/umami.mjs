async function sendUmamiEvent(payload) {
    if (process.env.NODE_ENV !== 'production') return;

    await fetch(`https://${process.env.UMAMI_SITE_URL}/api/send`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
            type: 'event',
            payload: {
                website: process.env.UMAMI_SITE_ID,
                hostname: getHostname(),
                screen: '1x1',
                language: 'en',
                ...payload,
            },
        }),
    })
        .then((response) => response.text())
        .catch((error) => {
            console.error('Error:', error);
        });
}

export async function umamiTrackPage(title, url) {
    await sendUmamiEvent({ title, url });
}

export async function umamiTrackEvent(title, url, name, data = {}) {
    await sendUmamiEvent({ title, url, name, data });
}

function getHostname() {
    switch (process.env.NODE_ENV) {
        case 'development':
            return 'localhost';
        case 'staging':
            return 'staging.helldivers.bot';
        case 'production':
            return 'helldivers.bot';
        default:
            throw new Error('Unknown NODE_ENV');
    }
}
