Connecting to a Kafka Consumer is easy. Let's try to connect to one using
the Stream implementation

```js
/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Transform = require('stream').Transform;

var Kafka = require('../');

var consumer = new Kafka.KafkaConsumer({
  'metadata.broker.list': 'localhost:9092',
  'group.id': 'librd-test',
  'socket.keepalive.enable': true,
  'enable.auto.commit': false
});

var stream = consumer.getReadStream('test', {
  waitInterval: 0
});

stream.on('error', function() {
  process.exit(1);
});

consumer.on('rebalance', function(e) {

  if (e.code === Kafka.CODES.REBALANCE.PARTITION_ASSIGNMENT) {
    console.log('Partition assignment');
  } else {
    console.log('Partition unassignment');
  }
});

stream
  .pipe(new Transform({
    objectMode: true,
    transform: function(data, encoding, callback) {
      // consumer.commit(data, function(err) {});
      // We want to force it to run async
      callback(null, data.message);
    }
  }))
  .pipe(process.stdout);

consumer.on('event.error', function(err) {
  console.log(err);
});
```
