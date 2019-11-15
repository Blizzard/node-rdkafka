/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var HighLevelProducer = require('../../lib/producer/high-level-producer');
var t = require('assert');
var Promise = require('bluebird');
// var Mock = require('./mock');

var client;
var defaultConfig = {
  'client.id': 'kafka-mocha',
  'metadata.broker.list': 'localhost:9092',
  'socket.timeout.ms': 250
};
var topicConfig = {};

var server;

module.exports = {
  'High Level Producer client': {
    'beforeEach': function() {
      client = new HighLevelProducer(defaultConfig, topicConfig);
    },
    'afterEach': function() {
      client = null;
    },
    'is an object': function() {
      t.equal(typeof(client), 'object');
    },
    'requires configuration': function() {
      t.throws(function() {
        return new HighLevelProducer();
      });
    },
    'has necessary methods from superclass': function() {
      var methods = ['_oldProduce'];
      methods.forEach(function(m) {
        t.equal(typeof(client[m]), 'function', 'Client is missing ' + m + ' method');
      });
    },
    'does not modify config and clones it': function () {
      t.deepStrictEqual(defaultConfig, {
        'client.id': 'kafka-mocha',
        'metadata.broker.list': 'localhost:9092',
        'socket.timeout.ms': 250
      });
      t.deepStrictEqual(client.globalConfig, {
        'client.id': 'kafka-mocha',
        'metadata.broker.list': 'localhost:9092',
        'socket.timeout.ms': 250
      });
      t.notEqual(defaultConfig, client.globalConfig);
    },
    'does not modify topic config and clones it': function () {
      t.deepStrictEqual(topicConfig, {});
      t.deepStrictEqual(client.topicConfig, {});
      t.notEqual(topicConfig, client.topicConfig);
    },
    'produce method': {
      'headers support': function(next) {
        var v = 'foo';
        var k = 'key';
        var h = [
          { key1: "value1A" },
          { key1: "value1B" },
          { key2: "value2" },
          { key1: "value1C" },
        ];
        var jsonH = JSON.stringify(h);

        client._oldProduce = function(topic, partition, value, key, timestamp, opaque, headers) {
          t.equal(value, 'foo');
          t.equal(key, 'key');
          t.equal(JSON.stringify(headers), jsonH);
          next();
        };

        client.produce('tawpic', 0, v, k, null, h, function() {

        });
      },

      'can use a custom serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          t.deepEqual(v, Buffer.from('foo'));
          t.equal(k, 'key');
          next();
        };

        client.setValueSerializer(function(_) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          return Buffer.from('foo');
        });

        client.setKeySerializer(function(_) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          return 'key';
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      'can use a value asynchronous custom serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          t.deepEqual(v, Buffer.from('foo'));
          t.equal(k, 'key');
          next();
        };

        client.setValueSerializer(function(_, cb) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          setImmediate(function() {
            cb(null, Buffer.from('foo'));
          });
        });

        client.setKeySerializer(function(_) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          return 'key';
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      'can use a key asynchronous custom serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          t.deepEqual(v, Buffer.from('foo'));
          t.equal(k, 'key');
          next();
        };

        client.setValueSerializer(function(_) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          return Buffer.from('foo');
        });

        client.setKeySerializer(function(_, cb) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          setImmediate(function() {
            cb(null, 'key');
          });
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      'can use two asynchronous custom serializers': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          t.deepEqual(v, Buffer.from('foo'));
          t.equal(k, 'key');
          next();
        };

        client.setValueSerializer(function(_, cb) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          setImmediate(function() {
            cb(null, Buffer.from('foo'));
          });
        });

        client.setKeySerializer(function(_, cb) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          setImmediate(function() {
            cb(null, 'key');
          });
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      // Promise API
      'can use a value promise-based custom serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          next();
        };

        client.setValueSerializer(function(_) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          return new Promise(function(resolve) {
            resolve(Buffer.from(''));
          });
        });

        client.setKeySerializer(function(_) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          return null;
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      'can use a key promise-based custom serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          t.deepEqual(v, Buffer.from('foo'));
          t.equal(k, 'key');
          next();
        };

        client.setValueSerializer(function(_) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          return Buffer.from('foo');
        });

        client.setKeySerializer(function(_) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          return new Promise(function(resolve) {
            resolve('key');
          });
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      'can use two promise-based custom serializers': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        var valueSerializerCalled = false;
        var keySerializerCalled = false;

        client._oldProduce = function(topic, partition, v, k, timestamp, opaque) {
          t.equal(valueSerializerCalled, true);
          t.equal(keySerializerCalled, true);
          t.deepEqual(v, Buffer.from('foo'));
          t.equal(k, 'key');
          next();
        };

        client.setValueSerializer(function(_) {
          valueSerializerCalled = true;
          t.deepEqual(_, v);
          return new Promise(function(resolve) {
            resolve(Buffer.from('foo'));
          });
        });

        client.setKeySerializer(function(_) {
          keySerializerCalled = true;
          t.deepEqual(_, k);
          return new Promise(function(resolve) {
            resolve('key');
          });
        });

        client.produce('tawpic', 0, v, k, null, function() {

        });
      },

      'bubbles up serializer errors in an async value serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        client.setValueSerializer(function(_, cb) {
          t.deepEqual(_, v);
          setImmediate(function() {
            cb(new Error('even together we failed'));
          });
        });

        client.produce('tawpic', 0, v, k, null, function(err) {
          t.equal(typeof err, 'object', 'an error should be returned');
          next();
        });
      },

      'bubbles up serializer errors in an async key serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        client.setKeySerializer(function(_, cb) {
          t.deepEqual(_, v);
          setImmediate(function() {
            cb(new Error('even together we failed'));
          });
        });

        client.produce('tawpic', 0, v, k, null, function(err) {
          t.equal(typeof err, 'object', 'an error should be returned');
          next();
        });
      },

      'bubbles up serializer errors in a sync value serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        client.setValueSerializer(function(_, cb) {
          t.deepEqual(_, v);
          throw new Error('even together we failed');
        });

        client.produce('tawpic', 0, v, k, null, function(err) {
          t.equal(typeof err, 'object', 'an error should be returned');
          next();
        });
      },

      'bubbles up serializer errors in a sync key serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        client.setKeySerializer(function(_, cb) {
          t.deepEqual(_, v);
          throw new Error('even together we failed');
        });

        client.produce('tawpic', 0, v, k, null, function(err) {
          t.equal(typeof err, 'object', 'an error should be returned');
          next();
        });
      },

      'bubbles up serializer errors in a promise-based value serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        client.setValueSerializer(function(_) {
          t.deepEqual(_, v);

          return new Promise(function (resolve, reject) {
            reject(new Error('even together we failed'));
          });
        });

        client.produce('tawpic', 0, v, k, null, function(err) {
          t.equal(typeof err, 'object', 'an error should be returned');
          next();
        });
      },

      'bubbles up serializer errors in a promise-based key serializer': function(next) {
        var v = {
          disparaging: 'hyena',
        };

        var k = {
          delicious: 'cookie',
        };

        client.setKeySerializer(function(_) {
          t.deepEqual(_, v);

          return new Promise(function(resolve, reject) {
            return new Promise(function (resolve, reject) {
              reject(new Error('even together we failed'));
            });
          });
        });

        client.produce('tawpic', 0, v, k, null, function(err) {
          t.equal(typeof err, 'object', 'an error should be returned');
          next();
        });
      },
    }
  },
};
