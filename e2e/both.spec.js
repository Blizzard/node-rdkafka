/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var crypto = require('crypto');
var t = require('assert');

var Kafka = require('../');

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

var TestCase = require('./test-case');
var md5hash = crypto.createHash('md5');
md5hash.update(crypto.randomBytes(20).toString());
var grp = 'kafka-mocha-grp-' + md5hash.digest('hex');

var testCase = new TestCase('Interoperability tests', function() {

  this.test('consumer can read produced messages', function(cb) {
    this.timeout(50000);
    var producerConnected = false;
    var consumerConnected = false;
    var producer;
    var consumer;
    var producerDisconnected = false;
    var consumerDisconnected = false;

    var maybeDoneDisconnecting = function() {
      if (consumerDisconnected && producerDisconnected) {
        cb();
      }
    };

    var disconnect = function() {
      return cb();
      /*
      console.log('Disconnecting');
      if (consumer) {
        console.log('DCing consumer');
        consumer.disconnect(function() {
          console.log('Done dcing consumer');
          consumerDisconnected = true;
          maybeDoneDisconnecting();
        });
      } else {
        consumerDisconnected = true;
        maybeDoneDisconnecting();
      }

      if (producer) {
        console.log('DCing producer');
        producer.disconnect(function() {
          console.log('Done dcing producer');
          producerDisconnected = true;
          maybeDoneDisconnecting();
        });
      } else {
        producerDisconnected = true;
        maybeDoneDisconnecting();
      }
      */

    };

    // Maybe Done

    var maybeDone = function() {
      if (producerConnected && consumerConnected) {
        var topic = 'test';

        crypto.randomBytes(4096, function(ex, buffer) {

          var pT = setInterval(function() {
            producer.produce({
              message: buffer,
              topic: topic
            }, function(err) {
              t.ifError(err);
            });
          }, 2000);

          var tt = setInterval(function() {
            if (!producer.isConnected()) {
              clearInterval(tt);
            } else {
              producer.poll();
            }
          }, 100);

          var offset;

          producer.once('delivery-report', function(report) {
            clearInterval(tt);
            offset = report.offset;
          });

          consumer
            .subscribe([topic]);

          var ct;

          var consumeOne = function() {
            consumer.consume(function(err, message) {
              if (err && (err.code === -191 || err.code === -185)) {
                ct = setTimeout(consumeOne, 100);
                return;
              }

              clearInterval(tt);
              clearInterval(pT);

              if (err) {
                return cb(err);
              }

              try {
                t.equal(Array.isArray(consumer.assignments()), true, 'Assignments should be an array');
                t.equal(consumer.assignments().length > 0, true, 'Should have at least one assignment');
                t.equal(buffer.toString(), message.message.toString(),
                  'message is not equal to buffer');
              } catch (e) {
                return cb(e);
              }
              disconnect();
            });
          };

          consumeOne();

          // Consume until we get it or time out

        });
      }
    };

    producer = new Kafka.Producer({
      'client.id': 'kafka-mocha',
      'metadata.broker.list': kafkaBrokerList,
      'fetch.wait.max.ms': 1,

      'dr_cb': true
    });

    producer.connect({}, function(err, d) {
      try {
        t.ifError(err);
        t.equal(typeof d, 'object', 'metadata should be returned');
      } catch (e) {
        return cb(e);
      }
      producerConnected = true;
      maybeDone();
    });

    consumer = new Kafka.KafkaConsumer({
      'metadata.broker.list': kafkaBrokerList,
      'group.id': grp,
      'fetch.wait.max.ms': 1000,
      'session.timeout.ms': 10000,
      'enable.auto.commit': true
      // paused: true,
    }, {
      'auto.offset.reset': 'largest'
    });

    consumer.connect({}, function(err, d) {
      t.ifError(err);
      t.equal(typeof d, 'object', 'metadata should be returned');
      consumerConnected = true;
      maybeDone();
    });

  });

});

testCase.run(function(err) {
  if (!err) {
    console.log('All tests passed successfully');
  }

  process.exit();
});
