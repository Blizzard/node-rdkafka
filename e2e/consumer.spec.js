/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var t = require('assert');
var crypto = require('crypto');

var KafkaConsumer = require('../').KafkaConsumer;

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString();

var TestCase = require('./test-case');

var testCase = new TestCase('Consumer tests', function() {
  this.test('properly rebalances', function(cb) {
    var consumer;

    consumer = new KafkaConsumer({
      'group.id': grp,
      'metadata.broker.list': kafkaBrokerList,
      'fetch.wait.max.ms': 1,
      'session.timeout.ms': 2000,
    });
    consumer.connect({}, function(err, metadata) {
      try {
        t.ifError(err);
        t.equal(typeof metadata, 'object', 'metadata should be returned');

        // Ensure it is in the correct format
        t.ok(metadata.orig_broker_name, 'Broker name is not set');
        t.ok(metadata.orig_broker_id, 'Broker id is not set');
        t.equal(Array.isArray(metadata.brokers), true);
        t.equal(Array.isArray(metadata.topics), true);
      } catch (e) {
        return cb(e);
      }

      consumer.disconnect(function(err) {
        cb();
      });
    });
  });
});

testCase.run(function(err) {
  if (err) {
    return process.exit(1);
  }

  console.log('All tests passed successfully');

  process.exit(0);

});
