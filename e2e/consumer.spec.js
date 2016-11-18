/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var t = require('assert');
var crypto = require('crypto');

var eventListener = require('./listener');

var KafkaConsumer = require('../').KafkaConsumer;

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

describe('Consumer', function() {
  var gcfg;

  beforeEach(function() {
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString();
     gcfg = {
      'bootstrap.servers': kafkaBrokerList,
      'group.id': grp,
      'debug': 'all'
    };
  });

  describe('committed', function() {

    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to get committed offsets', function(cb) {
      consumer.committed(1000, function(err, committed) {
        t.ifError(err);
        t.equal(Array.isArray(committed), true, 'Committed offsets should be an array');
        for (var x in committed) {
          var toppar = committed[x];
          t.equal(typeof toppar, 'object', 'TopicPartition should be an object');
          t.equal(typeof toppar.offset, 'number', 'Offset should be a number');
        }
        cb();
      });
    });

    it('should obey the timeout', function(cb) {
      consumer.committed(0, function(err, committed) {
        if (!err) {
          t.fail(err, 'not null', 'Error should be set for a timeout');
        }
        cb();
      });
    });

  });

  describe('subscribe', function() {

    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to subscribe', function() {
      t.equal(0, consumer.subscription().length);
      consumer.subscribe(['test']);
      t.equal(1, consumer.subscription().length);
      t.equal('test', consumer.subscription()[0]);
      t.equal(0, consumer.assignments().length);
    });

    it('should be able to unsusbcribe', function() {
      consumer.subscribe(['test']);
      t.equal(1, consumer.subscription().length);
      consumer.unsubscribe();
      t.equal(0, consumer.subscription().length);
      t.equal(0, consumer.assignments().length);
    });
  });

  describe('assign', function() {

    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to take an assignment', function() {
      t.equal(0, consumer.assignments().length);
      consumer.assign([{ topic:'test', partition:0 }]);
      t.equal(1, consumer.assignments().length);
      t.equal('test', consumer.assignments()[0].topic);
      t.equal(0, consumer.subscription().length);
    });

    xit('should be able to take an empty assignment - EXCLUDED because of https://github.com/Blizzard/node-rdkafka/issues/63', function() {
      consumer.assign([{ topic:'test', partition:0 }]);
      t.equal(1, consumer.assignments().length);
      consumer.assign([]);
      t.equal(0, consumer.assignments().length);
    });
  });

  describe('disconnect', function() {
    var tcfg = { 'auto.offset.reset': 'earliest' };

    it('should happen gracefully', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.disconnect(function() {
          cb();
        });

      });

    });

    it('should happen without issue after subscribing', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe(['test']);

        consumer.disconnect(function() {
          cb();
        });

      });

    });

    it('should happen without issue after consuming', function(cb) {
      this.timeout(11000);

      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.setDefaultConsumeTimeout(10000);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe(['test']);

        consumer.consume(function(err, message) {
          t.ifError(err);

          consumer.disconnect(function() {
            cb();
          });
        });

      });

    });

    it('should happen without issue after consuming an error', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.setDefaultConsumeTimeout(1);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe(['test']);

        consumer.consume(function(err, message) {
          t.notEqual(err, undefined, 'Error should not be undefined.');
          t.notEqual(err, null, 'Error should not be null.');
          t.equal(message, undefined, 'Message should not be set');

          consumer.disconnect(function() {
            cb();
          });
        });

      });

    });

  });

});
