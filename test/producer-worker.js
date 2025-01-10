var WorkerThreads = require('worker_threads');
var Kafka = require('../');

if (WorkerThreads.isMainThread) {
  var worker = new WorkerThreads.Worker(__filename);

  var timeout = setTimeout(function() {
    worker.terminate();
  }, 1000);

  worker.on('message', function(report) {
    console.log('delivery report', report);
  });

  worker.on('exit', function(code) {
    clearTimeout(timeout);
    process.exit(code);
  });

  return;
}

const stream = Kafka.Producer.createWriteStream({
  'metadata.broker.list': 'localhost:9092',
  'client.id': 'kafka-mocha-producer',
  'dr_cb': true
}, {}, {
  topic: 'topic'
});

stream.producer.on('delivery-report', function(err, report) {
  WorkerThreads.parentPort?.postMessage(report);
  stream.producer.disconnect();
});

stream.write(Buffer.from('my message'));
