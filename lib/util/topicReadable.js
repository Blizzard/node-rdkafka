/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

'use strict';

module.exports = TopicReadable;

var Readable = require('stream').Readable;
var util = require('util');

util.inherits(TopicReadable, Readable);

/**
 * ReadableStream integrating with the Kafka Consumer.
 *
 * This class is used to read data off of Kafka in a streaming way. It is
 * useful if you'd like to have a way to pipe Kafka into other systems. You
 * should generally not make this class yourself, as it is not even exposed
 * as part of module.exports. Instead, you should getReadStream off of a Kafka
 * Consumer.
 *
 * The stream implementation is slower than the continuous subscribe callback.
 * If you don't care so much about backpressure and would rather squeeze
 * out performance, use that method. Using the stream will ensure you read only
 * as fast as you write.
 *
 * The stream detects if Kafka is already connected. If it is, it will begin
 * reading. If it is not, it will connect and read when it is ready.
 *
 * This stream operates in objectMode. It streams {Consumer~Message}
 *
 * @param {Consumer} consumer - The Kafka Consumer object.
 * @param {array} topics - Array of topics
 * @param {object} options - Options to configure the stream.
 * @param {number} options.waitInterval - Number of ms to wait if Kafka reports
 * that it has timed out or that we are out of messages (right now).
 * @constructor
 * @extends stream.Readable
 * @see Consumer~Message
 */
function TopicReadable(consumer, topics, options) {
  if (!(this instanceof TopicReadable)) {
    return new TopicReadable(consumer, topics, options);
  }

  if (options === undefined) {
    options = { waitInterval: 1000 };
  } else if (typeof options === 'number') {
    options = { waitInterval: options };
  } else if (options === null || typeof options !== 'object') {
    throw new TypeError('"options" argument must be a number or an object');
  }

  if (!Array.isArray(topics)) {
    if (typeof topics !== 'string') {
      throw new TypeError('"topics" argument must be a string or an array');
    } else {
      topics = [topics];
    }
  }

  options = Object.create(options);
  options.objectMode = true;

  Readable.call(this, options);

  this.consumer = consumer;
  this.topics = topics;
  this.autoClose = options.autoClose === undefined ? true : !!options.autoClose;
  this.waitInterval = options.waitInterval === undefined ? 1000 : options.waitInterval;
  this.rebalanced = undefined;
  this.connected = false;
  this.fetchSize = options.fetchSize || 1;

  var self = this;

  this.consumer
    .once('rebalance', function() {
      self.rebalanced = true;
    })
    .on('disconnected', function() {
      self.rebalanced = undefined;
      self.connected = false;
    });

  if (!this.consumer.isConnected()) {
    this.connect();
  } else {
    this.consumer.subscribe(self.topics);
    this.connected = true;
  }

  this.on('end', function() {
    if (this.autoClose) {
      this.destroy();
    }
  });

}

/**
 * Internal stream read method.
 * @param {number} size - This parameter is ignored for our cases.
 * @private
 */
TopicReadable.prototype._read = function(size) {
  if (!this.connected) {
    return this.once('connected', function() {
      // This is the way Node.js does it
      // https://github.com/nodejs/node/blob/master/lib/fs.js#L1733
      this._read(size);
    });
  }

  if (this.destroyed) {
    return;
  }

  var self = this;

  this.consumer.consume(this.fetchSize, onread);

  function onread(err, messages) {
    if (err) {
      // bad error
      if (self.autoClose) {
        self.destroy();
      }
      self.emit('error', err);
      return;
    }

    // If there are no messages it means we reached EOF or a timeout.
    // Do what we used to do

    if (messages.length < 1) {

      if (!self.waitInterval) {
        setImmediate(function() {
          self._read(size);
        });
      } else {
        setTimeout(function() {
          self._read(size);
        }, self.waitInterval).unref();
      }

      return;
    } else if (messages.length === 1) {
      self.push(messages[0]);
    } else {
      self.push(messages);
    }

  }
};

TopicReadable.prototype.connect = function() {
  var self = this;

  self.consumer.connect({}, function(err, metadata) {
    if (err) {
      self.emit('error', err);
      self.destroy();
      return;
    }

    self.connected = true;
    // Subscribe to the topics as well so we will be ready
    self.consumer.subscribe(self.topics);

    self.emit('connected');
    // start the flow of data
    self.read();
  });

};

TopicReadable.prototype.destroy = function() {
  if (this.destroyed) {
    return;
  }
  this.destroyed = true;
  this.close();
};

TopicReadable.prototype.close = function(cb) {
  var self = this;
  if (cb) {
    this.once('close', cb);
  }

  self.connected = false;
  close();

  function close() {
    self.consumer.unsubscribe();
    self.emit('closed');
  }
};
