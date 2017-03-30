/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
'use strict';

module.exports = KafkaConsumer;

var Client = require('./client');
var util = require('util');
var Kafka = require('../librdkafka.js');
var TopicReadable = require('./topic-readable');
var LibrdKafkaError = require('./error');

util.inherits(KafkaConsumer, Client);

/**
 * KafkaConsumer class for reading messages from Kafka
 *
 * This is the main entry point for reading data from Kafka. You
 * configure this like you do any other client, with a global
 * configuration and default topic configuration.
 *
 * Once you instantiate this object, connecting will open a socket.
 * Data will not be read until you tell the consumer what topics
 * you want to read from.
 *
 * @param {object} conf - Key value pairs to configure the consumer
 * @param {object} topicConf - Key value pairs to create a default
 * topic configuration
 * @extends Client
 * @constructor
 */
function KafkaConsumer(conf, topicConf) {
  if (!(this instanceof KafkaConsumer)) {
    return new KafkaConsumer(conf, topicConf);
  }

  var onRebalance = conf.rebalance_cb;

  var self = this;

  // If rebalance is undefined we don't want any part of this
  if (onRebalance && typeof onRebalance === 'boolean') {
    conf.rebalance_cb = function(e) {
      // Emit the event
      self.emit('rebalance', e);
      // That's it
      if (e.code === 500 /*CODES.REBALANCE.PARTITION_ASSIGNMENT*/) {
        self.assign(e.assignment);
      } else if (e.code === 501 /*CODES.REBALANCE.PARTITION_UNASSIGNMENT*/) {
        self.unassign();
      }
    };
  } else if (onRebalance && typeof onRebalance === 'function') {
    /*
     * Once this is opted in to, that's it. It's going to manually rebalance
     * forever. There is no way to unset config values in librdkafka, just
     * a way to override them.
     */

     conf.rebalance_cb = function(e) {
       self.emit('rebalance', e);
       onRebalance.call(self, e);
     };
  }


  /**
   * KafkaConsumer message.
   *
   * This is the representation of a message read from Kafka.
   *
   * @typedef {object} KafkaConsumer~Message
   * @property {buffer} value - the message buffer from Kafka.
   * @property {string} topic - the topic name
   * @property {number} partition - the partition on the topic the
   * message was on
   * @property {number} offset - the offset of the message
   * @property {string} key - the message key
   * @property {number} size - message size, in bytes.
   */

  Client.call(this, conf, Kafka.KafkaConsumer, topicConf);

  this.globalConfig = conf;
  this.topicConfig = topicConf;

  this._consumeTimeout = 1000;
}

/**
 * Set the default consume timeout provided to c++land
 * @param {number} timeoutMs - number of milliseconds to wait for a message to be fetched
 */
KafkaConsumer.prototype.setDefaultConsumeTimeout = function(timeoutMs) {
  this._consumeTimeout = timeoutMs;
};

/**
 * Get a stream representation of this KafkaConsumer
 *
 * @see TopicReadable
 * @example
 * var consumer = new Kafka.KafkaConsumer({
 * 	'metadata.broker.list': 'localhost:9092',
 * 	'group.id': 'librd-test',
 * 	'socket.keepalive.enable': true,
 * 	'enable.auto.commit': false
 * });
 *
 * var stream = consumer.getReadStream('test');
 * @param {array} topics - An array of topics to subscribe to.
 * @param {object} options - Configuration for the stream.
 * @return {TopicReadable} - Readable stream that receives messages
 * when new ones become available.
 */
KafkaConsumer.prototype.getReadStream = function(topics, options) {
  return new TopicReadable(this, topics, options);
};

/**
 * Get a current list of the committed offsets per topic partition
 *
 * Returns an array of objects in the form of a topic partition list
 *
 * @param  {number} timeout - Number of ms to block before calling back
 * and erroring
 * @param  {Function} cb - Callback method to execute when finished or timed
 * out
 * @return {Client} - Returns itself
 */
KafkaConsumer.prototype.committed = function(timeout, cb) {
  var self = this;
  this._client.committed(timeout, function(err, topicPartitions) {
    if (err) {
      cb(LibrdKafkaError.create(err));
      return;
    }

    cb(null, topicPartitions);
  });
  return this;
};

/**
 * Assign the consumer specific partitions and topics
 *
 * @param {array} assignments - Assignments array. Should contain
 * objects with topic and partition set.
 * @return {Client} - Returns itself
 */

KafkaConsumer.prototype.assign = function(assignments) {
  this._client.assign(assignments);
  return this;
};

/**
 * Unassign the consumer from its assigned partitions and topics.
 *
 * @return {Client} - Returns itself
 */

KafkaConsumer.prototype.unassign = function() {
  this._client.unassign();
  return this;
};


/**
 * Get the assignments for the consumer
 *
 * @return {array} assignments - Array of topic partitions
 */

KafkaConsumer.prototype.assignments = function() {
  return this._errorWrap(this._client.assignments(), true);
};

/**
 * Subscribe to an array of topics (synchronously).
 *
 * This operation is pretty fast because it just sets
 * an assignment in librdkafka. This is the recommended
 * way to deal with subscriptions in a situation where you
 * will be reading across multiple files or as part of
 * your configure-time initialization.
 *
 * This is also a good way to do it for streams.
 *
 * @param  {array} topics - An array of topics to listen to
 * @throws - Throws when an error code came back from native land
 * @return {KafkaConsumer} - Returns itself.
 */
KafkaConsumer.prototype.subscribe = function(topics) {
  // Will throw if it is a bad error.
  this._errorWrap(this._client.subscribe(topics));
  this.emit('subscribed', topics);
  return this;
};

/**
 * Get the current subscription of the KafkaConsumer
 *
 * Get a list of subscribed topics. Should generally match what you
 * passed on via subscribe
 *
 * @see KafkaConsumer::subscribe
 * @throws - Throws when an error code came back from native land
 * @return {array} - Array of strings to show the current assignment
 */
KafkaConsumer.prototype.subscription = function() {
  return this._errorWrap(this._client.subscription(), true);
};

/**
 * Get the current offset position of the KafkaConsumer
 *
 * Returns a list of RdKafka::TopicPartitions on success, or throws
 * an error on failure
 *
 * @throws - Throws when an error code came back from native land
 * @return {array} - TopicPartition array. Each item is an object with
 * an offset, topic, and partition
 */
KafkaConsumer.prototype.position = function() {
  return this._errorWrap(this._client.position(), true);
};

/**
 * Unsubscribe from all currently subscribed topics
 *
 * Before you subscribe to new topics you need to unsubscribe
 * from the old ones, if there is an active subscription.
 * Otherwise, you will get an error because there is an
 * existing subscription.
 *
 * @throws - Throws when an error code comes back from native land
 * @return {KafkaConsumer} - Returns itself.
 */
KafkaConsumer.prototype.unsubscribe = function() {
  this._errorWrap(this._client.unsubscribe());
  this.emit('unsubscribe', []);
  return this;
};

/**
 * Read a number of messages from Kafka.
 *
 * This method is similar to the main one, except that it reads a number
 * of messages before calling back. This may get better performance than
 * reading a single message each time in stream implementations.
 *
 * This will keep going until it gets ERR__PARTITION_EOF or ERR__TIMED_OUT
 * so the array may not be the same size you ask for. The size is advisory,
 * but we will not exceed it.
 *
 * @param {number} size - Number of messages to read
 * @param {KafkaConsumer~readCallback} cb - Callback to return when work is done.
 *//**
 * Read messages from Kafka as fast as possible
 *
 * This method keeps a background thread running to fetch the messages
 * as quickly as it can, sleeping only in between EOF and broker timeouts.
 *
 * Use this to get the maximum read performance if you don't care about the
 * stream backpressure.
 * @param {KafkaConsumer~readCallback} cb - Callback to return when a message
 * is fetched.
 */
KafkaConsumer.prototype.consume = function(number, cb) {
  var timeoutMs = this._consumeTimeout || 1000;

  var self = this;
  if ((number && typeof number === 'number') || (number && cb)) {

    if (cb === undefined) {
      cb = function() {};
    } else if (typeof cb !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    this._consumeNum(timeoutMs, number, cb);

  } else {

    if (cb === undefined) {
      cb = function() {};
    }

    this._consumeLoop(timeoutMs, cb);

  }

};

/**
 * Open a background thread and keep getting messages as fast
 * as we can. Should not be called directly, and instead should
 * be called using consume.
 *
 * @private
 * @see consume
 */
KafkaConsumer.prototype._consumeLoop = function(timeoutMs, cb) {
  var self = this;

  self._client.consumeLoop(timeoutMs, function readCallback(err, message) {

    if (err) {
      // A few different types of errors here
      // but the two we do NOT care about are
      // time outs and broker no more messages
      // at least now
      cb(LibrdKafkaError.create(err));
    } else {
      /**
       * Data event. called whenever a message is received.
       *
       * @event KafkaConsumer#data
       * @type {KafkaConsumer~Message}
       */
      self.emit('data', message);
      cb(err, message);
    }
  });

};

/**
 * Consume a number of messages and wrap in a try catch with
 * proper error reporting. Should not be called directly,
 * and instead should be called using consume.
 *
 * @private
 * @see consume
 */
KafkaConsumer.prototype._consumeNum = function(timeoutMs, numMessages, cb) {
  var self = this;

  this._client.consume(timeoutMs, numMessages, function(err, messages) {
    if (err) {
      err = LibrdKafkaError.create(err);
      if (cb) {
        cb(err);
      }
      return;
    }

    for (var i = 0; i < messages.length; i++) {
      self.emit('data', messages[i]);
    }

    if (cb) {
      cb(null, messages);
    }

  });

};

/**
 * This callback returns the message read from Kafka.
 *
 * @callback KafkaConsumer~readCallback
 * @param {LibrdKafkaError} err - An error, if one occurred while reading
 * the data.
 * @param {KafkaConsumer~Message} message
 */

/**
 * Commit a topic partition or all topic partitions that have been read
 *
 * If you provide a topic partition, it will commit that. Otherwise,
 * it will commit all read offsets for all topic partitions.
 *
 * @param {object|null} - Topic partition object to commit, or null if you
 * are going to commit all read offsets.
 * @throws
 *
 * @return {KafkaConsumer} - returns itself.
 */
KafkaConsumer.prototype.commit = function(topicPartition) {
  this._errorWrap(this._client.commit(topicPartition), true);
  return this;
};

/**
 * Commit a message or all messages that have been read
 *
 * If you provide a message, it will commit that message. Otherwise,
 * it will commit all read offsets.
 *
 * This is basically a convenience method to map commit properly. We need to
 * add one to the offset in this case
 *
 * @param {object} - Message object to commit or callback
 * if you are committing all messages
 * @throws
 *
 * @return {KafkaConsumer} - returns itself.
 */
KafkaConsumer.prototype.commitMessage = function(msg) {
  var topicPartition = {
    topic: msg.topic,
    partition: msg.partition,
    offset: msg.offset + 1
  };

  return this._client.commit(topicPartition);
};

/**
 * Commit a topic partition (or all topic partitions) synchronously
 *
 * @param {object|null} - Topic partition object to commit, or null if you
 * are going to commit all read offsets.
 * @throws
 *
 * @return {KafkaConsumer} - returns itself.
 */
KafkaConsumer.prototype.commitSync = function(topicPartition) {
  this._errorWrap(this._client.commitSync(topicPartition), true);
  return this;
}

/**
 * Commit a message (or all messages) synchronously
 *
 * @see KafkaConsumer#commitMessageSync
 * @param  {object} msg - A message object to commit. If none
 * is provided, we will commit all read offsets.
 * @throws
 *
 * @return {KafkaConsumer} - returns itself.
 */
KafkaConsumer.prototype.commitMessageSync = function(msg) {
  var topicPartition = {
    topic: msg.topic,
    partition: msg.partition,
    offset: msg.offset + 1
  };

  return this._client.commitSync(topicPartition);
};
