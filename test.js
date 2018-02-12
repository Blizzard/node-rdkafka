var KafkaConsumer = require('./').KafkaConsumer;
var crypto = require('crypto');

var consumer = new KafkaConsumer({
 'bootstrap.servers': 'localhost:9092',
 'group.id': 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex'),
 'debug': 'all',
 'rebalance_cb': true,
 'enable.auto.commit': false
}, {});

var topic = 'test';

consumer.connect({ timeout: 2000 }, function(err, info) {
  consumer.commit([{ topic: topic, partition: 0, offset: -1 }]);

  consumer.disconnect(function() {

  });
});
