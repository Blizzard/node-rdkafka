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

var serviceStopped = false;

describe('Producer', function() {

  var producer;

  beforeEach(function(done) {
    producer = new Kafka.Producer({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList,
      'dr_cb': true,
      'debug': 'all'
    });
    producer.connect({}, function(err) {
      t.ifError(err);
      done();
    });

    eventListener(producer);
  });

  afterEach(function(done) {
    producer.disconnect(function() {
      done();
    });
  });

  it('should connect to Kafka', function(done) {
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

  it('should produce a message with a null payload and null key', function(done) {
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
      t.ok( report.key === null);
      done();
    });

    producer.produce('test', null, null, null);
  });

  xit('should produce a message with an empty payload and empty key (https://github.com/Blizzard/node-rdkafka/issues/36)', function(done) {
    this.timeout(3000);

    var tt = setInterval(function() {
      producer.poll();
    }, 200);

    producer.once('delivery-report', function(report) {
      clearInterval(tt);
      t.ok(report !== undefined);
      t.ok(typeof report.topic === 'string');
      t.ok(typeof report.partition === 'number');
      t.ok(typeof report.offset === 'number');
      t.ok( report.key === '', 'key should be an empty string');
      done();
    });

    producer.produce('test', null, new Buffer(''), '');
  });

  it('should produce a message with a payload and key', function(done) {
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
      t.equal('key', report.key);
      done();
    });

    producer.produce('test', null, new Buffer('value'), 'key');
  });

  it('should get 100% deliverability', function(done) {
    this.timeout(3000);

    var total = 0;
    var max = 10000;
    var verified_received = 0;

    var tt = setInterval(function() {
      producer.poll();
    }, 200);

    producer
      .on('delivery-report', function(err, report) {
        t.ifError(err);
        t.ok(report !== undefined);
        t.ok(typeof report.topic === 'string');
        t.ok(typeof report.partition === 'number');
        t.ok(typeof report.offset === 'number');
        verified_received++;
        if (verified_received === max) {
          clearInterval(tt);
          done();
        }
      });

    // Produce
    for (total = 0; total <= max; total++) {
      producer.produce('test', null, new Buffer('message ' + total), null);
    }

  });

  it('should produce a message to a Topic object', function(done) {
    this.timeout(3000);

    var tt = setInterval(function() {
      producer.poll();
    }, 200);

    var topic = producer.Topic('test', {
     'request.required.acks': 1
     //'produce.offset.report': true
    });

    producer.once('delivery-report', function(err, report) {
      clearInterval(tt);
      t.ifError(err);
      t.ok(report !== undefined);
      t.ok(typeof report.topic === 'string');
      t.ok(typeof report.partition === 'number');
      t.ok(typeof report.offset === 'number');
      t.equal('key', report.key);
      done();
    });

    producer.produce(topic, null, new Buffer('value'), 'key');
  });

});
