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
  var consumer;

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

      consumer = new Kafka.KafkaConsumer({
        //'debug': 'all',
        'metadata.broker.list': kafkaBrokerList,
        'group.id': 'node-rdkafka-consumer-flow-example',
        'enable.auto.commit': true,
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

    it('should get 100% deliverability if transaction is commited', function(done) {
      this.timeout(3000);

      var total = 0;
      var max = 100;
      var transactions_timeout_ms = 200;

      var tt = setInterval(function() {
        producer.poll();
      }, 200);
      var topic = "test";

      consumer.on('ready', function(arg) {
        consumer.subscribe([topic]);

        //start consuming messages
        consumer.consume();

        producer.initTransactions(transactions_timeout_ms);
        producer.beginTransaction();

        for (total = 0; total <= max; total++) {
          producer.produce(topic, null, Buffer.from('message ' + total), null);
        }

        producer.commitTransaction(transactions_timeout_ms);
      });

      var counter = 0;
      consumer.on('data', function(m) {
        counter++;

        consumer.commit(m);
        if (counter == max) {
          clearInterval(tt);
          done()
        }
      });

      consumer.on('event.error', function(err) {
        console.error('Error from consumer');
        console.error(err);
      });

      consumer.connect();
    });

    it('no message should be delivered if transaction is aborted', function(done) {
      this.timeout(3000);

      var total = 0;
      var max = 100;
      var transactions_timeout_ms = 200;

      var tt = setInterval(function() {
        producer.poll();
      }, 200);
      var topic = "test";

      consumer.on('ready', function(arg) {
        consumer.subscribe([topic]);

        //start consuming messages
        consumer.consume();

        producer.initTransactions(transactions_timeout_ms);
        producer.beginTransaction();

        for (total = 0; total <= max; total++) {
          producer.produce(topic, null, Buffer.from('message ' + total), null);
        }

        producer.abortTransaction(transactions_timeout_ms);
      });

      var received = 0;
      consumer.on('data', function(m) {
        received++;
        consumer.commit(m);
      });

      var delivery_reports = 0;
      producer.on('delivery-report', function(err, report) {
        delivery_reports++;
        t.notStrictEqual(report, undefined);
        t.notStrictEqual(err, undefined);
        if (delivery_reports == max) {
          clearInterval(tt);
          t.strictEqual(0, received)
          done();
        }
      });

      consumer.on('event.error', function(err) {
        console.error('Error from consumer');
        console.error(err);
      });

      consumer.connect();
    });
  });

});
