/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var KafkaConsumer = require('../lib/kafka-consumer');
var t = require('assert');

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
  },
};
