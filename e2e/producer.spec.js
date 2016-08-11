/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');
var t = require('assert');
var crypto = require('crypto');

var TestCase = require('./test-case');

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

var serviceStopped = false;

var topic = 'test'; // + crypto.randomBytes(20).toString();
var producer;

var testCase = new TestCase('Producer tests', function() {

  this.test('Can connect to Kafka', function(cb) {
    function producerConnected() {
      producer.getMetadata({}, function(err, metadata) {
        try {
          t.ifError(err);
          t.ok(metadata);

          // Ensure it is in the correct format
          t.ok(metadata.orig_broker_name, 'Broker name is not set');
          t.ok(metadata.orig_broker_id, 'Broker id is not set');
          t.equal(Array.isArray(metadata.brokers), true);
          t.equal(Array.isArray(metadata.topics), true);

        } catch (err) {
          cb(err);
          return;
        }

        producer.disconnect(function() {
          producer = null;
          cb();
        });
      });
    }


    producer = new Kafka.Producer({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList,
      'dr_cb': true
    });
    producer.connect({}, function(err) {
      if (err) {
        cb(err); return;
      }

      producerConnected();
    });
  });

  this.test('Producer gets 100% deliverability', function(cb) {
    producer = new Kafka.Producer({
      'client.id': 'kafka-mocha',
      'metadata.broker.list': kafkaBrokerList,
      'dr_cb': true
    });
    producer.connect();

    var total = 0;
    var totalSent = 0;
    var max = 10000;
    var errors = 0;
    var started = Date.now();

    var sendMessage = function() {
      if (totalSent < 1) {
      //   topic = producer.Topic(topic, {});
      }
      var ret = producer.produce({
        topic: topic,
        message: new Buffer('message ' + total)
      }, function(err) {
        total++;
        totalSent++;
        if (err) {
          return cb(err);
        } else {
          if (total >= max) {
          } else {
            sendMessage();
          }
        }
      });

    };

    var verified_received = 0;
    var exitNextTick = false;
    var errorsArr = [];

    var tt = setInterval(function() {
      producer.poll();

      if (exitNextTick) {
        clearInterval(tt);
        if (errors > 0) {
          return cb(errorsArr[0]);
        }
        producer.disconnect(function() {
          cb();
        });

        return;
      }

      if (verified_received + errors === max) {
        exitNextTick = true;
      }

    }, 1000).unref();

    producer
      .on('delivery-report', function(report) {
        try {
          t.ok(report !== undefined);
          t.ok(typeof report.topic_name === 'string');
          t.ok(typeof report.partition === 'number');
          t.ok(typeof report.offset === 'number');
        } catch (e) {
          cb(e);
        }
        verified_received++;
      }).on('ready', sendMessage);
  });

});

testCase.run(function(err) {
  if (err) {
    process.exitCode = 1;
  } else {
    console.log('All tests passed successfully');
  }

  // let x = process._getActiveHandles();
  // let y = process._getActiveRequests();

  // console.log(x);
  // console.log(y);
  process.exit();

});
