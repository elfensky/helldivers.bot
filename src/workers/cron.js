const { parentPort } = require('worker_threads');

parentPort.on('message', async (key) => {
    async function doWork() {
        const url = `http://localhost:3000/api/h1/update?key=${key}`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            parentPort.postMessage({ data, time: new Date().toString() });
        } catch (err) {
            parentPort.postMessage({
                error: err.toString(),
                time: new Date().toString(),
            });
        }
        setTimeout(doWork, 20000);
    }
    doWork();
});
