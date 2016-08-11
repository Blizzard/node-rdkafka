/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');
var crypto = require('crypto');
var count = 0;
var total = 0;
var totalComplete = 0;
var verifiedComplete = 0;
var errors = 0;
var store = [];
var started;
var done = false;
var host = process.argv[2] || '127.0.0.1:9092';
var topicName = process.argv[3] || 'test';
var compression = process.argv[4] || 'gzip';
var MAX = process.argv[5] || 100000;

var producer = new Kafka.Producer({
  'metadata.broker.list': host,
  'group.id': 'node-rdkafka-bench',
  'compression.codec': compression,
  'retry.backoff.ms': 200,
  'message.send.max.retries': 10,
  'socket.keepalive.enable': true,
  'queue.buffering.max.messages': 100000,
  'queue.buffering.max.ms': 1000,
  'batch.num.messages': 1000,
  // paused: true,
});

// Track how many messages we see per second
var interval;
var ok = true;

function getTimer() {
  if (!interval)
    interval = setTimeout(function() {
      interval = false;
      if (!done) {
        console.log('%d messages per sent second', count);
        store.push(count);
        count = 0;
        getTimer();

      } else {
        console.log('%d messages remaining sent in last batch <1000ms', count);
      }
   }, 1000);

   return interval;
}

var t;

crypto.randomBytes(4096, function(ex, buffer) {

  producer.connect()
    .on('ready', function() {
      var topic = producer.Topic(topicName, {});
      getTimer();

      started = new Date().getTime();

      var x = function(e) {
        if (e) {
          console.log(e);
          errors += 1;
        } else {
          verifiedComplete += 1;
        }
        count += 1;
        totalComplete += 1;
        if (totalComplete === MAX) {
          shutdown();
        }
      };

      var sendMessage = function() {
        producer.produce({
          topic: topic,
          message: buffer
        }, x);
        if (total < MAX) {
          total += 1;
          setImmediate(sendMessage);
        }
      };

      sendMessage();

    })
    .on('error', function(err) {
      console.error(err);
      process.exit(1);
    })
    .on('disconnected', shutdown);

});

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
process.once('SIGHUP', shutdown);

function shutdown(e) {
  done = true;

  clearInterval(interval);

  var killTimer = setTimeout(function() {
    process.exit();
  }, 5000);

  producer.disconnect(function() {
    clearTimeout(killTimer);
    var ended = new Date().getTime();
    var elapsed = ended - started;

    // console.log('Ended %s', ended);
    console.log('total: %d messages over %d ms', total, elapsed);

    console.log('%d messages / second', parseInt(total / (elapsed / 1000)));
    process.exit();
  });

}
