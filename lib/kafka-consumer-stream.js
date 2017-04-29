/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

'use strict';

module.exports = KafkaConsumerStream;

var Readable = require('stream').Readable;
var util = require('util');

util.inherits(KafkaConsumerStream, Readable);

/**
 * ReadableStream integrating with the Kafka Consumer.
 *
 * This class is used to read data off of Kafka in a streaming way. It is
 * useful if you'd like to have a way to pipe Kafka into other systems. You
 * should generally not make this class yourself, as it is not even exposed
 * as part of module.exports. Instead, you should KafkaConsumer.createReadStream.
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
 * @param {object} options - Options to configure the stream.
 * @param {number} options.waitInterval - Number of ms to wait if Kafka reports
 * that it has timed out or that we are out of messages (right now).
 * @param {array} options.topics - Array of topics
 * @constructor
 * @extends stream.Readable
 * @see Consumer~Message
 */
function KafkaConsumerStream(consumer, options) {
  if (!(this instanceof KafkaConsumerStream)) {
    return new KafkaConsumerStream(consumer, options);
  }

  if (options === undefined) {
    options = { waitInterval: 1000 };
  } else if (typeof options === 'number') {
    options = { waitInterval: options };
  } else if (options === null || typeof options !== 'object') {
    throw new TypeError('"options" argument must be a number or an object');
  }

  var topics = options.topics;

  if (!Array.isArray(topics)) {
    if (typeof topics !== 'string' && !(topics instanceof RegExp)) {
      throw new TypeError('"topics" argument must be a string, regex, or an array');
    } else {
      topics = [topics];
    }
  }

  options = Object.create(options);

  // Run in object mode by default.
  if (options.objectMode === null || options.objectMode === undefined) {
    options.objectMode = true;
  }

  if (options.objectMode !== true) {
    this._read = this._read_buffer;
  } else {
    this._read = this._read_message;
  }

  Readable.call(this, options);

  this.consumer = consumer;
  this.topics = topics;
  this.autoClose = options.autoClose === undefined ? true : !!options.autoClose;
  this.waitInterval = options.waitInterval === undefined ? 1000 : options.waitInterval;
  this.fetchSize = options.fetchSize || 1;

  var self = this;

  this.consumer
    .on('unsubscribed', function() {
      // Invalidate the stream when we unsubscribe
      self.push(null);
    });

  if (!this.consumer.isConnected()) {
    this.connect();
  } else {
    this.consumer.subscribe(self.topics);
  }

  this.once('end', function() {
    if (this.autoClose) {
      this.destroy();
    }
  });

}

/**
 * Internal stream read method. This method reads message objects.
 * @param {number} size - This parameter is ignored for our cases.
 * @private
 */
KafkaConsumerStream.prototype._read_message = function(size) {
  if (!this.consumer.isConnected()) {
    this.consumer.once('ready', function() {
      // This is the way Node.js does it
      // https://github.com/nodejs/node/blob/master/lib/fs.js#L1733
      this._read(size);
    }.bind(this));
    return;
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
        }, self.waitInterval * Math.random()).unref();
      }

      return;
    } else {
      for (var i = 0; i < messages.length; i++) {
        self.push(messages[i]);
      }
    }

  }
};

/**
 * Internal stream read method. This method reads message buffers.
 * @param {number} size - This parameter is ignored for our cases.
 * @private
 */
KafkaConsumerStream.prototype._read_buffer = function(size) {
  if (!this.consumer.isConnected()) {
    this.consumer.once('ready', function() {
      // This is the way Node.js does it
      // https://github.com/nodejs/node/blob/master/lib/fs.js#L1733
      this._read(size);
    }.bind(this));
    return;
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
        }, self.waitInterval * Math.random()).unref();
      }

      return;
    } else {
      for (var i = 0; i < messages.length; i++) {
        self.push(messages[i].value);
      }
    }

  }
};

KafkaConsumerStream.prototype.connect = function() {
  var self = this;

  self.consumer.connect({}, function(err, metadata) {
    if (err) {
      self.emit('error', err);
      self.destroy();
      return;
    }

    // Subscribe to the topics as well so we will be ready
    self.consumer.subscribe(self.topics);

    // start the flow of data
    self.read();
  });

};

KafkaConsumerStream.prototype.destroy = function() {
  if (this.destroyed) {
    return;
  }
  this.destroyed = true;
  this.close();
};

KafkaConsumerStream.prototype.close = function(cb) {
  var self = this;
  if (cb) {
    this.once('close', cb);
  }

  if (!self.consumer._isConnecting && !self.consumer._isConnected) {
    // If we aren't even connected just exit. We are done.
    close();
    return;
  }

  if (self.consumer._isConnecting) {
    self.consumer.once('ready', function() {
      // Don't pass the CB because it has already been passed.
      self.close();
    });
    return;
  }

  if (self.consumer._isConnected) {
    self.consumer.unsubscribe();
    self.consumer.disconnect(function() {
      self.consumer = null;
      close();
    });
  }

  function close() {
    self.emit('close');
  }
};
