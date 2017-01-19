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
var eventListener = require('./listener');

describe('Consumer/Producer', function() {

  var producer;
  var consumer;

  beforeEach(function(done) {
    producer = new Kafka.Producer({
      'client.id': 'kafka-mocha',
      'metadata.broker.list': kafkaBrokerList,
      'fetch.wait.max.ms': 1,
      'debug': 'all',
      'dr_cb': true
    });

    producer.connect({}, function(err, d) {
      t.ifError(err);
      t.equal(typeof d, 'object', 'metadata should be returned');
      done();
    });

    eventListener(producer);

  });

  beforeEach(function(done) {
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');

    consumer = new Kafka.KafkaConsumer({
      'metadata.broker.list': kafkaBrokerList,
      'group.id': grp,
      'fetch.wait.max.ms': 1000,
      'session.timeout.ms': 10000,
      'enable.auto.commit': true,
      'debug': 'all'
      // paused: true,
    }, {
      'auto.offset.reset': 'largest'
    });

    consumer.connect({}, function(err, d) {
      t.ifError(err);
      t.equal(typeof d, 'object', 'metadata should be returned');
      done();
    });

    eventListener(consumer);
  });

  afterEach(function(done) {
    consumer.disconnect(function() {
      done();
    });
  });

  afterEach(function(done) {
    producer.disconnect(function() {
      done();
    });
  });

  it('should be able to produce, consume messages, read position: subscribe/consumeOnce', function(done) {
    this.timeout(20000);
    var topic = 'test';

    crypto.randomBytes(4096, function(ex, buffer) {

      var tt = setInterval(function() {
        producer.poll();
      }, 100);

      var offset;

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        offset = report.offset;
      });

      consumer.subscribe([topic]);

      var ct;

      var consumeOne = function() {
        consumer.consume(function(err, message) {
          if (err && err.code === -191) {
            producer.produce(topic, null, buffer, null);
            ct = setTimeout(consumeOne, 100);
            return;
          } else if (err && err.code === -185) {
            ct = setTimeout(consumeOne, 100);
            return;
          }

          t.ifError(err);
          t.equal(Array.isArray(consumer.assignments()), true, 'Assignments should be an array');
          t.equal(consumer.assignments().length > 0, true, 'Should have at least one assignment');
          t.equal(buffer.toString(), message.value.toString(),
            'message is not equal to buffer');
          
          // test consumer.position as we have consumed
          var position = consumer.position();
          t.equal(position.length, 1);
          t.deepStrictEqual(position[0].partition, 0);
          t.ok(position[0].offset >= 0);
          done();
        });
      };

      // Consume until we get it or time out
      consumeOne();

    });
  });

  it('should be able to produce and consume messages: consumeLoop', function(done) {
    this.timeout(20000);
    var topic = 'test';
    var key = 'key';

    crypto.randomBytes(4096, function(ex, buffer) {

      var tt = setInterval(function() {
        producer.poll();
      }, 100);

      producer.once('delivery-report', function(err, report) {
        //console.log('delivery-report: ' + JSON.stringify(report));
        clearInterval(tt);
        t.ifError(err);
        t.equal(topic, report.topic, 'invalid delivery-report topic');
        t.equal(key, report.key, 'invalid delivery-report key');
        t.ok(report.offset >= 0, 'invalid delivery-report offset');
      });

      consumer.on('data', function(message) {
        t.equal(buffer.toString(), message.value.toString(), 'invalid message value');
        t.equal(key, message.key, 'invalid message key');
        t.equal(topic, message.topic, 'invalid message topic');
        t.ok(message.offset >= 0, 'invalid message offset');
        done();
      });

      consumer.consume([topic]);

      setTimeout(function() {
        producer.produce(topic, null, buffer, key);
      }, 2000);

    });
  });

  it('should be able to take an assignment with an offset (faking seek)', function(done) {
    this.timeout(10000);
    var numMsg = 10;
    var offset1;
    var offset2;
    var tt;

    producer.on('delivery-report', function(err, report) {
      if (report.opaque === numMsg) {
        clearInterval(tt);

        // seek to somewhere in between
        offset1 = report.offset -(numMsg/2);
        offset2 = report.offset - numMsg;
        consumer.assign([{ topic:'test', partition:0, offset: offset1 }]);
        t.equal(1, consumer.assignments().length);

        consumer.consume(1, function(err, messages) {
          t.equal(1, messages.length, "first consume once should return one message");
          t.equal(offset1, messages[0].offset);

          // seek to somewhere else
          consumer.unassign();
          consumer.assign([{ topic:'test', partition:0, offset: offset2 }]);

          consumer.consume(1, function(err, messages) {
            t.equal(1, messages.length, "second consume once should return one message");
            t.equal(offset2, messages[0].offset);
            done();
          });
        });
      }
    });

    for (var i = 1; i <= numMsg; i++) {
      producer.produce('test', null, new Buffer('message' + i), 'key' + i, i);
    }

    tt = setInterval(function() {
      producer.poll();
    }, 100);

  });

});
