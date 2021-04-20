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

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

describe('Producer', function() {
  var producer;

  describe('with dr_cb', function() {
    beforeEach(function(done) {
      producer = new Kafka.Producer({
        'client.id': 'kafka-test',
        'metadata.broker.list': kafkaBrokerList,
        'dr_cb': true,
        'debug': 'all',
        'transactional.id': 'noderdkafka_transactions_test',
        'enable.idempotence': true
      });

      producer.connect({}, function(err) {
        t.ifError(err);
        done();
      });
    });

    afterEach(function(done) {
      producer.disconnect(function() {
        done();
      });
    });

    it('should throw exception if Init not called', function(done) {

      t.throws( () => {producer.beginTransaction()},
      {
        isTxnFatal: false,
        isTxnRetriable: false,
        isTxnRequiresAbort: false
      });

      done();
    })
  })
})
