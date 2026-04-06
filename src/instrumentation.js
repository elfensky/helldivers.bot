export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { initializeHelldivers1Api } = await import('./instrumentation.node');
        await initializeHelldivers1Api();
    }
}
