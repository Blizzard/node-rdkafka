/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

'use strict';

module.exports = TopicWritable;

var Writable = require('stream').Writable;
var util = require('util');

util.inherits(TopicWritable, Writable);

/**
 * Writable stream integrating with the Kafka Producer.
 *
 * This class is used to write data to Kafka in a streaming way. It takes
 * buffers of data and puts them into the appropriate Kafka topic. If you need
 * finer control over partitions or keys, this is probably not the class for
 * you. In that situation just use the Producer itself.
 *
 * The stream detects if Kafka is already connected. You can safely begin
 * writing right away.
 *
 * This stream does not operate in Object mode and can only be given buffers.
 *
 * @param {Producer} producer - The Kafka Producer object.
 * @param {array} topics - Array of topics
 * @param {object} options - Topic configuration.
 * @constructor
 * @extends stream.Writable
 */
function TopicWritable(producer, topicName, options) {
  if (!(this instanceof TopicWritable)) {
    return new TopicWritable(topicName, producer, options);
  }

  if (options === undefined) {
    options = {};
  } else if (typeof options === 'string') {
    options = { encoding: options };
  } else if (options === null || typeof options !== 'object') {
    throw new TypeError('"options" argument must be a string or an object');
  }

  options = Object.create(options);

  if (options.topic) {
    delete options.topic;
  }

  Writable.call(this, options);

  this.producer = producer;
  this.topicName = topicName;
  this.topicOptions = options.topic || {};
  this.topic = undefined;
  this.autoClose = options.autoClose === undefined ? true : !!options.autoClose;
  this.connected = false;

  if (options.encoding) {
    this.setDefaultEncoding(options.encoding);
  }

  if (this.producer.isConnected()) {
    this.connected = true;
  } else {
    this.connect();
  }

  this.once('finish', function() {
    if (this.autoClose) {
      this.close();
    }
  });

}

TopicWritable.prototype.connect = function() {
  this.producer.connect({}, function(err, data) {
    if (err) {
      this.emit('error', err);
      return;
    }

    this.connected = true;
    this.emit('connected', data);

  }.bind(this));
};

/**
 * Internal stream write method for TopicWritable.
 *
 * This method should never be called externally. It has some recursion to
 * handle cases where the producer is not yet connected.
 *
 * @param  {buffer} chunk - Chunk to write.
 * @param  {string} encoding - Encoding for the buffer
 * @param  {Function} cb - Callback to call when the stream is done processing
 * the data.
 * @private
 * @see https://github.com/nodejs/node/blob/master/lib/fs.js#L1901
 */
TopicWritable.prototype._write = function(data, encoding, cb) {
  if (!(data instanceof Buffer)) {
    this.emit('error', new Error('Invalid data. Can only produce buffers'));
    return;
  }

  if (!this.connected) {
    this.once('connected', function() {
      this._write(data, encoding, cb);
    });
    return;
  }

  var self = this;

  if (self.topic === undefined) {
    self.topic = self.producer.Topic(self.topicName, self.topicOptions);
  }

  return this.producer.produce({
    topic: self.topic,
    message: data,
  }, function streamSendMessageCallback(err) {
    if (err) {
      if (self.autoClose) {
        self.close();
      }
    }
    return cb(err);
  });
};

function writev(producer, topic, chunks, cb) {

  // @todo maybe a produce batch method?
  var doneCount = 0;
  var err = null;

  function maybeDone(e) {
    if (e) {
      err = e;
    }
    doneCount ++;
    if (doneCount === chunks.length) {
      cb(err);
    }
  }

  for (var i = 0; i < chunks.length; i++) {
    producer.produce({
      topic: topic,
      message: chunks[i]
    }, maybeDone);
  }

}

TopicWritable.prototype._writev = function(data, cb) {
  if (!this.connected) {
    this.once('connected', function() {
      this._writev(data, cb);
    });
    return;
  }

  var self = this;
  var len = data.length;
  var chunks = new Array(len);
  var size = 0;

  for (var i = 0; i < len; i++) {
    var chunk = data[i].chunk;

    chunks[i] = chunk;
    size += chunk.length;
  }

  writev(this.producer, this.topic, chunks, function(err) {
    if (err) {
      self.close();
      cb(err);
      return;
    }
    cb();
  });

};

TopicWritable.prototype.close = function(cb) {
  var self = this;
  if (cb) {
    this.once('close', cb);
  }

  self.connected = false;
  setImmediate(close);

  function close() {
    self.emit('closed');
  }
};
