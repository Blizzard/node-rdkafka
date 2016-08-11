```js
/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');

var producer = Kafka.Producer({});

function multiWrite(buffer, streams, cb) {
  var length = streams.length;
  var completed = 0;

  var done = function() {
    completed++;
    if (completed === length) {
      cb();
    }
  };

  streams.forEach(function(stream) {
    stream.write(buffer, null, done);
  });
}

var topic1 = producer.getWriteStream('topic1');
var topic2 = producer.getWriteStream('topic2');

multiWrite(new Buffer('test'), [topic1, topic2], function() {
    console.log('all done');
});
```
