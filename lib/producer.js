/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = Producer;

var Client = require('./client');

var util = require('util');
var Kafka = require('../librdkafka.js');
var TopicWritable = require('./util/topicWritable');
var LibrdKafkaError = require('./error');

util.inherits(Producer, Client);

/**
 * Producer class for sending messages to Kafka
 *
 * This is the main entry point for writing data to Kafka. You
 * configure this like you do any other client, with a global
 * configuration and default topic configuration.
 *
 * Once you instantiate this object, you need to connect to it first.
 * This allows you to get the metadata and make sure the connection
 * can be made before you depend on it. After that, problems with
 * the connection will by brought down by using poll, which automatically
 * runs when a transaction is made on the object.
 *
 * @param {object} conf - Key value pairs to configure the consumer
 * @param {object} topicConf - Key value pairs to create a default
 * topic configuration
 * @extends Client
 * @constructor
 */
function Producer(conf, topicConf) {
  if (!(this instanceof Producer)) {
    return new Producer(conf, topicConf);
  }

  /**
   * Producer message. This is sent to the wrapper, not received from it
   *
   * @typedef {object} Producer~Message
   * @property {string|buffer} message - The buffer to send to Kafka.
   * @property {Topic} topic - The Kafka topic to produce to.
   * @property {number} partition - The partition to produce to. Defaults to
   * the partitioner
   * @property {string} key - The key string to use for the message.
   * @see Consumer~Message
   */

  var gTopic = conf.topic || false;
  var gPart = conf.partition || null;
  var dr_cb = conf.dr_cb || null;
  var dr_msg_cb = conf.dr_msg_cb || null;

  // delete keys we don't want to pass on
  delete conf.topic;
  delete conf.partition;

  delete conf.dr_cb;
  delete conf.dr_msg_cb;

  // client is an initialized consumer object
  // @see NodeKafka::Consumer::Init
  Client.call(this, conf, Kafka.Producer, topicConf);
  var self = this;

  // Delete these keys after saving them in vars
  this.globalConfig = conf;
  this.topicConfig = topicConf;
  this.defaultTopic = gTopic || null;
  this.defaultPartition = gPart == null ? -1 : gPart;

  this.outstandingMessages = 0;
  this.sentMessages = 0;

  this.createdTopics = {};

  if (dr_msg_cb) {
    self.on('delivery-message-report', dr_msg_cb);
  }

  if (dr_cb) {
    this._client.onDeliveryReport(function onDeliveryReport(err, report) {
      if (err) {
        self.emit('error', LibrdKafkaError.create(err));
      } else {
        self.outstandingMessages--;
        self.emit('delivery-report', report);
      }
    });

    if (typeof dr_cb === 'function') {
      self.on('delivery-report', dr_cb);
    }

  }

}

/**
 * Create a topic if it does not exist. Otherwise, create it
 *
 * @private
 */
function maybeTopic(name, config) {
  // create or get topic
  var topic;

  if (typeof(name) === 'string') {

    // If config is an empty object, reuse the ones we have in cache
    if (config) {
      topic = this.Topic(name, config);
    } else {
      // if config is an empty object
      if (this.createdTopics[name]) {
        topic = this.createdTopics[name];
      } else {
        topic = this.createdTopics[name] = this.Topic(name, {});
      }
    }

    return topic;
  } else {
    // this may be what we want
    return name;
  }
}

/**
 * Create a topic by topic name and config
 *
 * This is a v8 managed object. It does this to avoid creating
 * a topic configuration every time we send a message, which,
 * in our case, is tens of thousands of times per second.
 *
 * Rather than that, since topics generally don't change much,
 * we just manage them in memory for however many we are using.
 * They are pretty small and it is easy since the name can act
 * as a key.
 *
 * This is a good place to start in an upgrade across the board
 * to v4
 * @version 0.12
 *
 * @param  {string} name - the name of the topic to create
 * @param {object} config - a topic configuration.
 * @return {Topic} - a new Kafka Topic.
 */
Producer.prototype.Topic = function(name, config) {
  try {
    if (!this._isConnected) {
      throw new Error('Producer not connected');
    }
    return new Kafka.Topic(name, config, this._client);
  } catch (err) {
    err.message = 'Error creating topic "' + name + '"": ' + err.message;
    throw LibrdKafkaError.create(err);
  }
};

/**
 * Produce a message to Kafka by providing an object
 *
 * This method is deprecated and maintained only for backwards compatibility.
 * You should use the new synchronous produce method, which does not
 * do object enumeration
 *
 * @param  {object} message - Produced message object
 * @param {function} cb - Optional callback
 * @deprecated
 * @see Producer::produce
 */
Producer.prototype._produceObject = util.deprecate(function(message, cb) {
  cb = cb || function() {};

  if (!Buffer.isBuffer(message.message)) {
    message.message = new Buffer(message.message);
  }

  try {
    this.produce(message.topic, message.partition, message.message, message.key);
    setImmediate(cb);
  } catch (e) {
    setImmediate(function() {
      cb(e);
    });
  }

}, 'Producer.produce: this function no longer takes an object. Instead, it takes "topic", "partition", "message", and "key"');

/**
 * Produce a message to Kafka synchronously.
 *
 * This is the method mainly used in this class. Use it to produce
 * a message to Kafka. The first and only parameter of the synchronous
 * variant is the message object.
 *
 * When this is sent off, there is no guarantee it is delivered. If you need
 * guaranteed delivery, change your *acks* settings, or use delivery reports.
 *
 * @param {Producer~Message} msg - The message object.
 * @throws {LibrdKafkaError} - Throws a librdkafka error if it failed.
 * @return {boolean} - returns an error if it failed, or true if not
 * @see Producer#produce
 */
Producer.prototype.produce = function(topic, partition, message, key) {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }

  if (typeof topic === 'object') {
    return this._produceObject(topic, partition);
  }

  if (!topic) {
    throw new TypeError('"topic" needs to be set');
  }

  this.outstandingMessages++;
  this.sentMessages++;

  partition = partition == null ? this.defaultPartition : partition;

  topic = maybeTopic.call(this, topic, false);

  return this._errorWrap(
    this._client.produce(topic, partition, message, key || null));

};

/**
 * Get a write stream for the given topic.
 *
 * This stream does not run in object mode. It only takes buffers of data.
 *
 * @param {string} topic - String topic name.
 * @param {object} options - Stream options
 * @param {number} options.highWaterMark - Controls how many messages are
 * read at a time.
 * @return {TopicWritable} - returns the write stream for writing to Kafka.
 */
Producer.prototype.getWriteStream = function(topic, options) {
  return new TopicWritable(this, topic, options);
};

/**
 * Poll for events
 *
 * We need to run poll in order to learn about new events that have occurred.
 * This is done automatically every time we produce a message, but if you'd
 * like to do it more because Kafka does not have enough traffic or because
 * you need to know at certain points, you can manually poll for changes.
 *
 * @return {Producer} - returns itself.
 */
Producer.prototype.poll = function() {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }
  this._client.poll();
  return this;
};

/**
 * Flush the producer
 *
 * Flush everything on the internal librdkafka producer buffer. Do this before
 * disconnects usually
 *
 * @return {Producer} - returns itself.
 */
Producer.prototype.flush = function(timeout) {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }
  this._client.flush(timeout);
  return this;
};
