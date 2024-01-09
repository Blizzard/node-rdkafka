var KafkaNode = require('./lib/index.js');

var consumer = new KafkaNode.KafkaConsumer(
  {
    'group.id': 'testing-37',
    'metadata.broker.list': 'localhost:9093',
    'enable.auto.commit': false,
  },
  {
    'auto.offset.reset': 'earliest',
  }
);

consumer.connect();

var topicName = 'consume-per-partition';

consumer.on('ready', function () {
  console.log('ready');

  consumer.subscribe([topicName]);

  setInterval(function () {
    consumer.consume(10, topicName, 1);
  }, 100);

  setInterval(function () {
    consumer.consume(10, topicName, 0);
  }, 2500);
})
  .on('data', function (message) {
    console.log('partition ' + message.partition + ' value: ' + message.value.toString());
    consumer.commitMessage(message);
  });
