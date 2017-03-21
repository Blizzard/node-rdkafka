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
var ProducerStream = require('./producer-stream');
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
 * @param {object} conf - Key value pairs to configure the producer
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

  this.sentMessages = 0;

  this.createdTopics = {};

  this.pollInterval = undefined;

  if (dr_msg_cb || dr_cb) {
    this._client.onDeliveryReport(function onDeliveryReport(err, report) {
      if (err) {
        err = LibrdKafkaError.create(err);
      }
      self.emit('delivery-report', err, report);
    }, !!dr_msg_cb);

    if (typeof dr_cb === 'function') {
      self.on('delivery-report', dr_cb);
    }

  }

}

/**
 * Create a topic if it does not exist. Otherwise, get the cached one
 *
 * @private
 */
function maybeTopic(name) {
  // create or get topic
  var topic;

  if (typeof(name) === 'string') {
    if (this.createdTopics[name]) {
      topic = this.createdTopics[name];
    } else {
      topic = name;
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
    return new Kafka.Topic(name, config || undefined);
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
 * @param {string} topic - The topic name to produce to.
 * @param {number|null} partition - The partition number to produce to.
 * @param {Buffer|null} message - The message to produce.
 * @param {string} key - The key associated with the message.
 * @param {number|null} timestamp - Timestamp to send with the message.
 * @param {object} opaque - An object you want passed along with this message, if provided.
 * @throws {LibrdKafkaError} - Throws a librdkafka error if it failed.
 * @return {boolean} - returns an error if it failed, or true if not
 * @see Producer#produce
 */
Producer.prototype.produce = function(topic, partition, message, key, timestamp, opaque) {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }

  if (typeof topic === 'object' && !(topic instanceof Kafka.Topic)) {
    return this._produceObject(topic, partition);
  }

  if (!topic) {
    throw new TypeError('"topic" needs to be set');
  }

  this.sentMessages++;

  partition = partition == null ? this.defaultPartition : partition;

  topic = maybeTopic.call(this, topic);

  // Okay... really quick
  // We do not support using a timestamp if topic is an object. I know, it's
  // weird.
  // https://github.com/edenhill/librdkafka/blob/master/src-cpp/rdkafkacpp.h#L1891
  // So... let's let the user know

  if (typeof topic !== 'string' && timestamp) {
    throw new TypeError('"topic" must be a string to use the 0.10 timestamp feature');
  }

  return this._errorWrap(
    this._client.produce(topic, partition, message, key, timestamp, opaque));

};

/**
 * Create a write stream interface for a producer.
 *
 * This stream does not run in object mode. It only takes buffers of data.
 *
 * @param {object} conf - Key value pairs to configure the producer
 * @param {object} topicConf - Key value pairs to create a default
 * topic configuration
 * @param {object} options - Stream options
 * @return {ProducerStream} - returns the write stream for writing to Kafka.
 */
Producer.createWriteStream = function(conf, topicConf, streamOptions) {
  var producer = new Producer(conf, topicConf);
  return new ProducerStream(producer, streamOptions);
};

/**
 * Poll for events
 *
 * We need to run poll in order to learn about new events that have occurred.
 * This is no longer done automatically when we produce, so we need to run
 * it manually, or set the producer to automatically poll.
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
 * Set automatic polling for events.
 *
 * We need to run poll in order to learn about new events that have occurred.
 * If you would like this done on an interval with disconnects and reconnections
 * managed, you can do it here
 *
 * @param {number} interval - Interval, in milliseconds, to poll
 *
 * @return {Producer} - returns itself.
 */
Producer.prototype.setPollInterval = function(interval) {
  // If we already have a poll interval we need to stop it
  if (this.pollInterval) {
    clearInterval(this.pollInterval);
    this.pollInterval = undefined;
  }

  if (interval === 0) {
    // If the interval was set to 0, bail out. We don't want to process this.
    // If there was an interval previously set, it has been removed.
    return;
  }

  var self = this;

  // Now we want to make sure we are connected.
  if (!this._isConnected) {
    // If we are not, execute this once the connection goes through.
    this.once('ready', function() {
      self.setPollInterval(interval);
    });
    return;
  }

  // We know we are connected at this point.
  // Unref this interval
  this.pollInterval = setInterval(function() {
    try {
      self.poll();
    } catch (e) {
      // We can probably ignore errors here as far as broadcasting.
      // Disconnection issues will get handled below
    }
  }, interval).unref();

  // Handle disconnections
  this.once('disconnected', function() {
    // Just rerun this function. It will unset the original
    // interval and then bind to ready
    self.setPollInterval(interval);
  });

  return this;
};

/**
 * Flush the producer
 *
 * Flush everything on the internal librdkafka producer buffer. Do this before
 * disconnects usually
 *
 * @param {number} timeout - Number of milliseconds to try to flush before giving up.
 * @param {function} callback - Callback to fire when the flush is done.
 *
 * @return {Producer} - returns itself.
 */
Producer.prototype.flush = function(timeout, callback) {
  if (!this._isConnected) {
    throw new Error('Producer not connected');
  }

  if (timeout === undefined || timeout === null) {
    timeout = 500;
  }

  this._client.flush(timeout, function(err) {
    if (err) {
      err = LibrdKafkaError.create(err);
    }

    if (callback) {
      callback(err);
    }
  });
  return this;
};
