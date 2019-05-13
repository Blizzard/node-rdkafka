const Kafka = require("../lib/index.js");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendData = async (producer, totalMessages) => {
    const topic = "node";
    const msg = "dkfljaskldfajkldsjfklasdjfalk;dsjfkl;asjfdskl;fjda;lkfjsdklfsajlkfjdsklfajsklfjsklanklsalkjkljkasfak";
    const buffer = Buffer.from(msg);
    const key = "test";
    for (let n = 0; n < totalMessages; ++n) {
        let bufferIsFull = false;
        do {
            bufferIsFull = false;
            try {
                producer.produce(topic, -1, buffer, key, null, n);
            }
            catch (error) {
                // Based on config, and messages, this will execute once
                if (error.code === Kafka.CODES.ERRORS.ERR__QUEUE_FULL) {
                    producer.poll();
                    // The wait introduces 11-12 seconds of latency when dr_cb is true
                    const start = process.hrtime();
                    await wait(50);
                    const latency = process.hrtime(start);
                    console.info(`Wait took ${latency[0]} seconds`);
                    bufferIsFull = true;
                } else {
                    throw error;
                }
            }
        } while (bufferIsFull);
    }
    console.log("Finished producing");
};

const verifyReports = async (reports, reportsComplete, totalMessages) => {
    const reportsTimeout = new Promise((resolve, reject) => {
        setTimeout(() => {
            reject("Delivery report timed out");
        }, 10000);
    });
    await Promise.race([reportsComplete, reportsTimeout]);
    await wait(500); // wait for some more delivery reports.
    if (reports.length === totalMessages) {
        console.log("Reports count match");
    } else { 
        console.error("Reports count doesn't match");
        return;
    }
    for(let n = 0; n < totalMessages; ++n) {
        if(reports[n].opaque !== n) {
            console.error("Expect message number does not match");
        }
    }
};

const run = async () => {
    const reports = [];
    const totalMessages = 1000100;
    const producer = new Kafka.Producer({
        "batch.num.messages": 50000,
        "compression.codec": "lz4",
        "delivery.report.only.error": false,
        "dr_cb": true,
        "metadata.broker.list": "localhost:9092",
        "message.send.max.retries": 10000000,
        "queue.buffering.max.kbytes": 2000000,
        "queue.buffering.max.messages": 1000000,
        "queue.buffering.max.ms": 0,
        "socket.keepalive.enable": true,
    }, {});

    producer.setPollInterval(100);
    producer.on("event.log", (obj) => console.log(obj));
    const reportsComplete = new Promise((resolve) => {
        producer.on("delivery-report", (err, report) => {
            reports.push(report);
            if(reports.length === totalMessages) {
                resolve();
            }
        });
    });

    const readyPromise = new Promise((resolve) => {
        producer.on("ready", async () => {
            console.log("Producer is ready");
            resolve();
        });
        producer.connect();
    });
    await readyPromise;

    await sendData(producer, totalMessages);
    await verifyReports(reports, reportsComplete, totalMessages);
    process.exit(0);
};

run().catch((err) => {
    console.error(err);
});
