export async function initializeEnvironmentVariables() {
    checkDatabase();
    checkUpdates();
    checkAnalytics();
    checkAuth();
    return true;
}

function checkDatabase() {
    //DATABASE
    if (!process.env.POSTGRES_URL) {
        throw new Error('POSTGRES_URL is not set');
    }
}

function checkUpdates() {
    //TODO - switch from runtime set api key to dynamic admin panel set key
    //UPDATES
    if (!process.env.UPDATE_KEY) {
        throw new Error('UPDATE_KEY is not set');
    }
    if (!process.env.UPDATE_INTERVAL) {
        throw new Error('UPDATE_INTERVAL is not set');
    }
    // PORT is optional, defaults to 3000 - used by the worker to poll the update endpoint
    if(!process.env.PORT) {
        console.info('PORT has defaulted to 3000')
    }
}

function checkAnalytics() {
    //ANALYTICS
    if (!process.env.UMAMI_SITE_ID) {
        throw new Error('UMAMI_SITE_ID is not set');
    }
}

function checkAuth() {
    //BETTER-AUTH
    if (!process.env.BETTER_AUTH_SECRET) {
        throw new Error('BETTER_AUTH_SECRET is not set');
    }
    if (!process.env.BETTER_AUTH_URL) {
        throw new Error('BETTER_AUTH_URL is not set');
    }
    //AUTH-DISCORD
    if (!process.env.AUTH_DISCORD_ID) {
        throw new Error('AUTH_DISCORD_ID is not set');
    }
    if (!process.env.AUTH_DISCORD_SECRET) {
        throw new Error('AUTH_DISCORD_SECRET is not set');
    }
    //AUTH-GITHUB
    if (!process.env.AUTH_GITHUB_ID) {
        throw new Error('AUTH_GITHUB_ID is not set');
    }
    if (!process.env.AUTH_GITHUB_SECRET) {
        throw new Error('AUTH_GITHUB_SECRET is not set');
    }
}
