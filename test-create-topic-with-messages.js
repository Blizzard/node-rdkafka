var KafkaNode = require('./lib/index.js');

var client = KafkaNode.AdminClient.create({
  'metadata.broker.list': 'localhost:9093'
});

var topicName = 'consume-per-partition';

client.deleteTopic('consume-per-partition', function () {
  client.createTopic({
    topic: topicName,
    num_partitions: 2,
    replication_factor: 1
  }, function (err) {
    fillTopic();
  });
});

function fillTopic() {
  var producer = new KafkaNode.Producer({
    'metadata.broker.list': 'localhost:9093'
  });

  producer.connect();

  producer.on('ready', function () {
    for (var i = 0; i < 500; i++) {
      producer.produce(topicName, 0, Buffer.from('message-' + i), null, Date.now());
    }
    for (var n = 0; n < 500; n++) {
      producer.produce(topicName, 1, Buffer.from('message-' + n), null, Date.now());
    }
  });
}
