/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var TopicPartition = require('../lib/topic-partition');
var Topic = require('../lib/topic');

var t = require('assert');

module.exports = {
  'TopicPartition': {
    'is a function': function() {
      t.equal(typeof(TopicPartition), 'function');
    },
    'be constructable': function() {
      var toppar = new TopicPartition('topic', 1, 0);

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.offset, 0);
      t.equal(toppar.partition, 1);
    },
    'be creatable using 0 as the partition': function() {
      var toppar = new TopicPartition('topic', 0, 0);

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.offset, 0);
      t.equal(toppar.partition, 0);
    },
    'throw if partition is null or undefined': function() {
      t.throws(function() {
        var tp = new TopicPartition('topic', undefined, 0);
      });

      t.throws(function() {
        var tp = new TopicPartition('topic', null, 0);
      });
    },
    'sets offset to stored by default': function() {
      var toppar = new TopicPartition('topic', 1);

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_STORED);
    },
    'sets offset to end if "end" is provided"': function() {
      var toppar = new TopicPartition('topic', 1, 'end');

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_END);
    },
    'sets offset to end if "latest" is provided"': function() {
      var toppar = new TopicPartition('topic', 1, 'latest');

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_END);
    },
    'sets offset to beginning if "beginning" is provided"': function() {
      var toppar = new TopicPartition('topic', 1, 'beginning');

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_BEGINNING);
    },
    'sets offset to start if "beginning" is provided"': function() {
      var toppar = new TopicPartition('topic', 1, 'beginning');

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_BEGINNING);
    },
    'sets offset to stored if "stored" is provided"': function() {
      var toppar = new TopicPartition('topic', 1, 'stored');

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_STORED);
    },
    'throws when an invalid special offset is provided"': function() {
      t.throws(function() {
        var toppar = new TopicPartition('topic', 1, 'fake');
      });
    }
  },
  'TopicPartition.map': {
    'is a function': function() {
      t.equal(typeof(TopicPartition.map), 'function');
    },
    'converts offsets inside the array': function() {
      var result = TopicPartition.map([{ topic: 'topic', partition: 1, offset: 'stored' }]);
      var toppar = result[0];

      t.equal(toppar.topic, 'topic');
      t.equal(toppar.partition, 1);
      t.equal(toppar.offset, Topic.OFFSET_STORED);
    },
  },
};
