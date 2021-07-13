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

describe('Send offsets to transaction', function() {
  var producer;
  var consumer;

  describe('with dr_cb', function() {
    beforeEach(function(done) {
      producer = new Kafka.Producer({
        'client.id': 'kafka-test',
        'metadata.broker.list': kafkaBrokerList,
        'dr_cb': true,
        'debug': 'all',
        'transactional.id': 'noderdkafka_transactions_send_offset',
        'enable.idempotence': true
      });

      consumer = new Kafka.KafkaConsumer({
        'metadata.broker.list': kafkaBrokerList,
        'group.id': 'node-rdkafka-consumer-send-offset',
        'enable.auto.commit': false,
        'isolation.level': 'read_committed'
      });

      producer.connect({}, function(err) {
        t.ifError(err);
        done();
      });
    });

    afterEach(function(done) {
      producer.disconnect(function() {
        consumer.disconnect(function() {
          done();
        });
      });
    });

    it('consumer offsets should get committed by sending to transaction', function(done) {
      this.timeout(3000);

      let transactions_timeout_ms = 200
      let topic = "test2"
      test_offset = [ { offset: 1000000, partition: 0, topic: 'test2' } ]

      consumer.on('ready', function(arg) {
        consumer.subscribe([topic]);

        consumer.consume();

        producer.initTransactions(transactions_timeout_ms);
        producer.beginTransaction();

        setTimeout(function() {
          producer.produce(topic, null, Buffer.from('test message'), null)
          producer.sendOffsetsToTransaction(test_offset, consumer, transactions_timeout_ms)

          producer.commitTransaction(transactions_timeout_ms)
        }, 1000);
      });

      consumer.once('data', function(m) {
        position = consumer.position()
        consumer.committed(null, transactions_timeout_ms, function (err, committed) {
          // Assert that what the consumer sees as committed offsets matches whats added to the transaction
          t.deepStrictEqual(test_offset, committed)
          done()
        })
      });

      consumer.on('event.error', function(err) {
        console.error(err);
      });

      consumer.connect();
    });
  });
});
