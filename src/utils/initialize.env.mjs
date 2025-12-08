export async function initializeEnvironmentVariables() {
    checkDatabase();
    checkUpdates();
    checkAnalytics();
    checkAuth();
    checkEmail();
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
}

function checkAnalytics() {
    //ANALYTICS
    if (!process.env.UMAMI_SITE_ID) {
        throw new Error('UMAMI_SITE_ID is not set');
    }
    if (!process.env.SENTRY_AUTH_TOKEN) {
        throw new Error('SENTRY_AUTH_TOKEN is not set');
    }
}

function checkAuth() {
    //NEXT-AUTH
    if (!process.env.AUTH_SECRET) {
        throw new Error('AUTH_SECRET is not set');
    }
    if (!process.env.AUTH_TRUST_HOST) {
        throw new Error('AUTH_TRUST_HOST is not set');
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
        throw new Error('AUTH_GOOGLE_ID is not set');
    }
    if (!process.env.AUTH_GITHUB_SECRET) {
        throw new Error('AUTH_GOOGLE_SECRET is not set');
    }
}

function checkEmail() {
    //EMAIL
    if (!process.env.EMAIL_SERVER_USER) {
        throw new Error('EMAIL_SERVER_USER is not set');
    }
    if (!process.env.EMAIL_SERVER_PASSWORD) {
        throw new Error('EMAIL_SERVER_PASSWORD is not set');
    }
    if (!process.env.EMAIL_SERVER_HOST) {
        throw new Error('EMAIL_SERVER_HOST is not set');
    }
    if (!process.env.EMAIL_SERVER_PORT) {
        throw new Error('EMAIL_SERVER_PORT is not set');
    }
    if (!process.env.EMAIL_FROM) {
        throw new Error('EMAIL_FROM is not set');
    }
}
