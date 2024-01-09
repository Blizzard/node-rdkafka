var KafkaNode = require('./lib/index.js');

var consumer = new KafkaNode.KafkaConsumer(
  {
    'group.id': 'testing-15',
    'metadata.broker.list': 'localhost:9093',
    'enable.auto.commit': false,
  },
  {
    'auto.offset.reset': 'earliest',
  }
);

consumer.connect();

consumer.on('ready', function () {
  consumer.subscribe(['testing-slow-destinations']);

  consumer.consume(100, 0, function (err, messages) {
    messages.forEach(function (message) {
      console.log('partition one value: ' + message.value.toString());
    });
  });

  consumer.consume(100, 1, function  (err, messages) {
    messages.forEach(function (message) {
      console.log('partition two value: ' + message.value.toString());
    });
  });
});
