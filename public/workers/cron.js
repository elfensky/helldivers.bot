const { parentPort } = require('worker_threads');

parentPort.on('message', async (msg) => {
    const { key, interval } = msg;

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
        setTimeout(doWork, interval * 1000); //important to use setTimeout, NOT setInterval, so it never triggers a new update until the old one is finished.
    }
    doWork();
});
