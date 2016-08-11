/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var addon = require('bindings')('node-librdkafka');
var t = require('assert');
// var Mock = require('./mock');

var client;
var defaultConfig = {
  'client.id': 'kafka-mocha',
  'metadata.broker.list': 'localhost:9092',
  'socket.timeout.ms': 250
};

var server;

module.exports = {
  'Producer client': {
    'beforeEach': function() {
      client = new addon.Producer(defaultConfig, {});
    },
    'afterEach': function() {
      client = null;
    },
    'is an object': function() {
      t.equal(typeof(client), 'object');
    },
    'requires configuration': function() {
      t.throws(function() {
        return new addon.Producer();
      });
    },
    'has necessary methods from superclass': function() {
      var methods = ['connect', 'disconnect', 'onEvent', 'getMetadata'];
      methods.forEach(function(m) {
        t.equal(typeof(client[m]), 'function', 'Client is missing ' + m + ' method');
      });
    },
    /*
    'with mock server': {
      'before': function(cb) {
        server = new Mock();
        server.on('ready', cb);
      },

      'after': function(cb) {
        server.close(cb);
      },

      'can connect': function(cb) {
        var producer = new addon.Producer(defaultConfig, {});
        producer.connect(function(err, info) {
          t.ifError(err);
          cb();
        });
      }
    }*/
  },
};
