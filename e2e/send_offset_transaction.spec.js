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
        'transactional.id': 'noderdkafka_transactions_send_offset',
        'enable.idempotence': true
      });

      consumer = new Kafka.KafkaConsumer({
        //'debug': 'all',
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

    it('consumer offsets should get commited by sending to transaction', function(done) {
      this.timeout(3000);

      var total = 0;
      var max = 100;
      var transactions_timeout_ms = 200;

      var tt = setInterval(function() {
        producer.poll();
      }, 200);
      var topic = "test2";

      consumer.on('ready', function(arg) {
        consumer.subscribe([topic]);

        //start consuming messages
        consumer.consume();

        producer.initTransactions(transactions_timeout_ms);
        producer.beginTransaction();

        setTimeout(function() {
          for (total = 0; total <= max; total++) {
            producer.produce(topic, null, Buffer.from('message ' + total), null);
          }
          producer.sendOffsetsToTransaction(consumer, transactions_timeout_ms)
          console.log("Calling commitTransaction")
          producer.commitTransaction(transactions_timeout_ms)
        }, 2000);
      });

      var counter = 0;
      consumer.on('data', function(m) {
        counter++;

        //consumer.commit(m);
        if (counter == max) {
          clearInterval(tt);
          console.log("Consumer positions are are: ", consumer.position())
          consumer.committed(null, transactions_timeout_ms, function (err, topicPartitions) {
            console.log("Consumer committed are are: ", topicPartitions)
          })
          done()
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
