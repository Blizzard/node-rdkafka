/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = HighLevelProducer;

var util = require('util');
var Producer = require('../producer');
var LibrdKafkaError = require('../error');
var EventEmitter = require('events').EventEmitter;
var RefCounter = require('../tools/ref-counter');
var shallowCopy = require('../util').shallowCopy;
var isObject = require('../util').isObject;

util.inherits(HighLevelProducer, Producer);

function noopSerializer(v) {
  return v;
}

/**
 * Create a serializer
 *
 * Method simply wraps a serializer provided by a user
 * so it adds context to the error
 *
 * @returns {function} Serialization function
 */
function createSerializer(serializer) {
  return function serializationWrapper(v) {
    try {
      return serializer(v);
    } catch (e) {
      var modifiedError = new Error('Could not serialize value: ' + e.message);
      modifiedError.value = v;
      modifiedError.serializer = serializer;
      throw modifiedError;
    }
  };
}

/**
 * Producer class for sending messages to Kafka in a higher level fashion
 *
 * This is the main entry point for writing data to Kafka if you want more
 * functionality than librdkafka supports out of the box. You
 * configure this like you do any other client, with a global
 * configuration and default topic configuration.
 *
 * Once you instantiate this object, you need to connect to it first.
 * This allows you to get the metadata and make sure the connection
 * can be made before you depend on it. After that, problems with
 * the connection will by brought down by using poll, which automatically
 * runs when a transaction is made on the object.
 *
 * This has a few restrictions, so it is not for free!
 *
 * 1. You may not define opaque tokens
 *    The higher level producer is powered by opaque tokens.
 * 2. Every message ack will dispatch an event on the node thread.
 * 3. Will use a ref counter to determine if there are outgoing produces.
 *
 * This will return the new object you should use instead when doing your
 * produce calls
 *
 * @param {object} conf - Key value pairs to configure the producer
 * @param {object} topicConf - Key value pairs to create a default
 * topic configuration
 * @extends Producer
 * @constructor
 */
function HighLevelProducer(conf, topicConf) {
  if (!(this instanceof HighLevelProducer)) {
    return new HighLevelProducer(conf, topicConf);
  }

  // Force this to be true for the high level producer
  conf = shallowCopy(conf);
  conf.dr_cb = true;

  // producer is an initialized consumer object
  // @see NodeKafka::Consumer::Init
  Producer.call(this, conf, Producer, topicConf);
  var self = this;

  // Add a delivery emitter to the producer
  this._hl = {
    deliveryEmitter: new EventEmitter(),
    messageId: 0,
    // Special logic for polling. We use a reference counter to know when we need
    // to be doing it and when we can stop. This means when we go into fast polling
    // mode we don't need to do multiple calls to poll since they all will yield
    // the same result
    pollingRefTimeout: null,
  };

  // Add the polling ref counter to the class which ensures we poll when we go active
  this._hl.pollingRef = new RefCounter(function() {
    self._hl.pollingRefTimeout = setInterval(function() {
      try {
        self.poll();
      } catch (e) {
        if (!self._isConnected) {
          // If we got disconnected for some reason there is no point
          // in polling anymore
          clearInterval(self._hl.pollingRefTimeout);
        }
      }
    }, 1);
  }, function() {
    clearInterval(self._hl.pollingRefTimeout);
  });

  // Default poll interval. More sophisticated polling is also done in create rule method
  this.setPollInterval(1000);

  // Listen to all delivery reports to propagate elements with a _message_id to the emitter
  this.on('delivery-report', function(err, report) {
    if (report.opaque && report.opaque.__message_id !== undefined) {
      self._hl.deliveryEmitter.emit(report.opaque.__message_id, err, report.offset);
    }
  });

  // Save old produce here since we are making some modifications for it
  this._oldProduce = this.produce;
  this.produce = this._modifiedProduce;

  // Serializer information
  this.keySerializer = noopSerializer;
  this.valueSerializer = noopSerializer;
}

/**
 * Produce a message to Kafka asynchronously.
 *
 * This is the method mainly used in this class. Use it to produce
 * a message to Kafka.
 *
 * When this is sent off, and you recieve your callback, the assurances afforded
 * to you will be equal to those provided by your ack level.
 *
 * @param {string} topic - The topic name to produce to.
 * @param {number|null} partition - The partition number to produce to.
 * @param {Buffer|null} message - The message to produce.
 * @param {string} key - The key associated with the message.
 * @param {number|null} timestamp - Timestamp to send with the message.
 * @param {function} callback - Callback to call when the delivery report is recieved.
 * @throws {LibrdKafkaError} - Throws a librdkafka error if it failed.
 * @return {boolean} - returns an error if it failed, or true if not
 * @see Producer#produce
 */
HighLevelProducer.prototype._modifiedProduce = function(topic, partition, message, key, timestamp, callback) {
  // Add the message id
  var opaque = {
    __message_id: this._hl.messageId++,
  };

  this._hl.pollingRef.increment();

  var self = this;

  this._hl.deliveryEmitter.once(opaque.__message_id, function(err, offset) {
    self._hl.pollingRef.decrement();
    setImmediate(function() {
      // Offset must be greater than or equal to 0 otherwise it is a null offset
      // Possibly because we have acks off
      callback(err, offset >= 0 ? offset : null);
    });
  });

  return this._oldProduce(topic, partition,
    this.valueSerializer(message), this.keySerializer(key),
    timestamp, opaque);
};

/**
 * Set the key serializer
 *
 * This allows the value inside the produce call to differ from the value of the
 * value actually produced to kafka. Good if, for example, you want to serialize
 * it to a particular format.
 */
HighLevelProducer.prototype.setKeySerializer = function(serializer) {
  this.keySerializer = createSerializer(serializer);
};

/**
 * Set the value serializer
 *
 * This allows the value inside the produce call to differ from the value of the
 * value actually produced to kafka. Good if, for example, you want to serialize
 * it to a particular format.
 */
HighLevelProducer.prototype.setValueSerializer = function(serializer) {
  this.valueSerializer = createSerializer(serializer);
};
