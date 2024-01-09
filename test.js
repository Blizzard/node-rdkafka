var KafkaNode = require('./lib/index.js');

var consumer = new KafkaNode.KafkaConsumer(
  {
    'group.id': 'testing-16',
    'metadata.broker.list': 'localhost:9093',
    'enable.auto.commit': false,
  },
  {
    'auto.offset.reset': 'earliest',
  }
);

consumer.connect();

consumer.on('ready', function () {
  console.log('ready');

  consumer.subscribe(['testing-slow-destinations']);

  consumer.consume(100, function (err, messages) {
    messages.forEach(function (message) {
      console.log('partition ' + message.partition + ' value: ' + message.value.toString());
    });
  });

  // consumer.consume(100, 0, function (err, messages) {
  //   messages.forEach(function (message) {
  //     console.log('partition one value: ' + message.value.toString());
  //   });
  // });
  // consumer.consume(100, 1, function  (err, messages) {
  //   messages.forEach(function (message) {
  //     console.log('partition two value: ' + message.value.toString());
  //   });
  // });
});

consumer.on('warning', function (e) {
  console.log('warning');
  console.log(e);
});

consumer.on('event.log', function (e) {
  console.log('event.log');
  console.log(e);
});

consumer.on('event.error', function (e) {
  console.log('event.error');
  console.log(e);
});
