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

var eventListener = require('./listener');

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';
var topic = 'test';

var serviceStopped = false;

describe('Producer', function() {

  var producer;

  var conf = {
    'client.id': 'kafka-test',
    'metadata.broker.list': kafkaBrokerList,
    'debug': 'all'
  };

  afterEach(function(done) {
    producer.disconnect(function() {
      done();
    });
  });

  describe('no dr_cb', function() {

    it('should connect to Kafka', function(done) {
      producer = new Kafka.Producer(conf);
      eventListener(producer);
      producer.connect({}, function(err) {
        t.ifError(err);

        producer.getMetadata({}, function(err, metadata) {
          t.ifError(err);
          t.ok(metadata);

          // Ensure it is in the correct format
          t.ok(metadata.orig_broker_name, 'Broker name is not set');
          t.ok(metadata.orig_broker_id, 'Broker id is not set');
          t.equal(Array.isArray(metadata.brokers), true);
          t.equal(Array.isArray(metadata.topics), true);
          done();
        });
      });
    });

  });

  describe('with dr_cb', function() {

    beforeEach(function(done) {
      conf.dr_cb = 'true';
      producer = new Kafka.Producer(conf);
      producer.connect({}, function(err) {
        t.ifError(err);
        done();
      });

      eventListener(producer);
    });

    it('should produce a message with a user-specified opaque', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.ok(report !== undefined);
        t.ok(report.topic === topic);
        t.ok(typeof report.partition === 'number');
        t.ok(typeof report.offset === 'number');
        t.equal(report.opaque, 'opaque');
        done();
      });

      producer.produce(topic, null, new Buffer('value'), null, 'opaque');
    });

    it('should produce a message without an "automatic opaque"', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.ok(report !== undefined);
        t.ok(report.topic === topic);
        t.ok(typeof report.partition === 'number');
        t.ok(typeof report.offset === 'number');
        t.ok(report.opaque === undefined);
        done();
      });

      producer.produce(topic, null, new Buffer('value'), null);
    });

    it('should produce a message with an opaque function', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.ok(typeof report.opaque === 'function');
        report.opaque();
      });

      producer.produce('test', null, new Buffer('value'), 'key', function() {
        done();
      });
    });

  });

  describe('with dr_msg_cb', function() {

    beforeEach(function(done) {
      conf.dr_msg_cb = 'true';
      producer = new Kafka.Producer(conf);
      producer.connect({}, function(err) {
        t.ifError(err);
        done();
      });

      eventListener(producer);
    });

    it('should produce a message with a user-specified opaque', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.ok(report !== undefined);
        t.ok(report.topic === topic);
        t.ok(typeof report.partition === 'number');
        t.ok(typeof report.offset === 'number');
        t.equal(report.opaque, 'opaque');
        done();
      });
      producer.produce(topic, null, new Buffer('value'), null, 'opaque');
    });

    it('should produce a message without an opaque and find key/value in the delivery report opaque', function(done) {
      this.timeout(3000);

      var tt = setInterval(function() {
        producer.poll();
      }, 200);

      producer.once('delivery-report', function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.ok(report !== undefined);
        t.ok(typeof report.topic === 'string');
        t.ok(typeof report.partition === 'number');
        t.ok(typeof report.offset === 'number');
        t.ok(typeof report.opaque === 'object');
        t.equal(report.opaque.key, 'key');
        t.equal(report.opaque.value.toString(), 'value');
        done();
      });

      producer.produce(topic, null, new Buffer('value'), 'key');
    });

  });

  describe('with dr_cb as function', function() {
    
    it('should invoke a user-specified dr_cb()', function(done) {
      this.timeout(3000);

      var tt;
      conf.dr_cb = function(err, report) {
        clearInterval(tt);
        t.ifError(err);
        t.ok(report !== undefined);
        t.ok(report.topic === topic);
        t.ok(typeof report.partition === 'number');
        t.ok(typeof report.offset === 'number');
        done();
      };

      producer = new Kafka.Producer(conf);
      eventListener(producer);
      producer.connect({}, function(err) {
        t.ifError(err);
        tt = setInterval(function() {
          producer.poll();
        }, 200);

        producer.produce(topic, null, new Buffer('value'), null);
      });

    });
  });

});
