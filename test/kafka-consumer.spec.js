/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var KafkaConsumer = require('../lib/kafka-consumer');
var Transform = require('stream').Transform;
var t = require('assert');
var Sinon = require('sinon')

var client;
var defaultConfig = {
  'client.id': 'kafka-mocha',
  'group.id': 'kafka-mocha-grp',
  'metadata.broker.list': 'localhost:9092'
};
var topicConfig = {};

module.exports = {
  'KafkaConsumer client': {
    'beforeEach': function() {
      client = new KafkaConsumer(defaultConfig, topicConfig);
    },
    'afterEach': function() {
      client = null;
    },
    'does not modify config and clones it': function () {
      t.deepStrictEqual(defaultConfig, {
        'client.id': 'kafka-mocha',
        'group.id': 'kafka-mocha-grp',
        'metadata.broker.list': 'localhost:9092'
      });
      t.deepStrictEqual(client.globalConfig, {
        'client.id': 'kafka-mocha',
        'group.id': 'kafka-mocha-grp',
        'metadata.broker.list': 'localhost:9092'
      });
      t.notEqual(defaultConfig, client.globalConfig);
    },
    'does not modify topic config and clones it': function () {
      t.deepStrictEqual(topicConfig, {});
      t.deepStrictEqual(client.topicConfig, {});
      t.notEqual(topicConfig, client.topicConfig);
    },

    '#stream()': {
      'beforeEach': function() {
        Sinon.stub(client, 'isConnected').returns(true);
        Sinon.stub(client, '_consumeNum').callsFake((timeout, size, cb) => {
          t.ok(typeof timeout === 'number' && size >= 0, 'consumer._consumeNum must be called with a timeout');
          t.ok(typeof size === 'number' && size > 0, 'consumer._consumeNum must be called with a size');
          t.equal(typeof cb, 'function', 'consumer._consumeNum must be called with a callback function');
          
          setImmediate(function() {
            cb(null, [{
              value: Buffer.from('test'),
              key: 'testKey',
              topic: 'test',
              partition: 0,
              offset: 1
            }])
          })
        });
        client._isConnecting = false;
        client._isConnected = true;
      },
      'afterEach': function(done) {
        client.isConnected.returns(false);
        client._isConnecting = false;
        client._isConnected = false;
        client.once('finished', done);
        client.emit('disconnected');
      },
      'can return a toppar stream': function() {
        const stream1 = client.stream({ topic: 'test', partition: 0 });
        const stream2 = client.stream({ topic: 'test', partition: 1 });
        const stream3 = client.stream({ topic: 'test', partition: 0 });
        
        t.ok(stream1 instanceof Transform);
        t.equal(stream1.topic, 'test', 'toppar stream has a topic attribute');
        t.equal(stream1.partition, 0, 'toppar stream has a partition attribute');
        t.notEqual(stream1, stream2, 'returns a separate stream for each different toppar');
        t.equal(stream1, stream3, 'returns the same toppar stream for the same toppar');

        stream1.destroy()
        stream2.destroy()
      },
    }
  },
};
