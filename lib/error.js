/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = LibrdKafkaError;

var util = require('util');
var librdkafka = require('../librdkafka');

util.inherits(LibrdKafkaError, Error);

LibrdKafkaError.create = createLibrdkafkaError;

/**
 * Enum for identifying errors reported by the library
 *
 * You can find this list in the C++ code at
 * https://github.com/edenhill/librdkafka/blob/master/src-cpp/rdkafkacpp.h#L148
 *
 * @readonly
 * @enum {number}
 * @constant
 */
LibrdKafkaError.codes = {};

for (var key in librdkafka.codes) {
  // Skip it if it doesn't start with ErrorCode
  if (key.indexOf('ErrorCode::') !== 0) {
    continue;
  }

  var newKey = key.replace('ErrorCode::', '');
  LibrdKafkaError.codes[newKey] = librdkafka.codes[key];
}

/**
 * Representation of a librdkafka error
 *
 * This can be created by giving either another error
 * to piggy-back on. In this situation it tries to parse
 * the error string to figure out the intent. However, more usually,
 * it is constructed by an error object created by a C++ Baton.
 *
 * @param {object|error} e - An object or error to wrap
 * @property {string} message - The error message
 * @property {number} code - The error code.
 * @property {string} origin - The origin, whether it is local or remote
 * @constructor
 */
function LibrdKafkaError(e) {
  if (!(this instanceof LibrdKafkaError)) {
    return new LibrdKafkaError(e);
  }

  // This is the better way
  if (!util.isError(e)) {
    this.message = e.message;
    this.code = e.code;
    this.errno = e.code;
    if (e.code >= LibrdKafkaError.codes.ERR__END) {
      this.origin = 'local';
    } else {
      this.origin = 'kafka';
    }
    Error.captureStackTrace(this, this.constructor);
  } else {
    var message = e.message;
    var parsedMessage = message.split(': ');

    var origin, msg;

    if (parsedMessage.length > 1) {
      origin = parsedMessage[0].toLowerCase();
      msg = parsedMessage[1].toLowerCase();
    } else {
      origin = 'unknown';
      msg = message.toLowerCase();
    }

    // special cases
    if (msg === 'consumer is disconnected' || msg === 'producer is disconnected') {
      this.origin = 'local';
      this.code = LibrdKafkaError.codes.ERR__STATE;
      this.errno = this.code;
      this.message = msg;
    } else {
      this.origin = origin;
      this.message = msg;
      this.code = -1;
      this.errno = this.code;
      this.stack = e.stack;
    }

  }

}

function createLibrdkafkaError(e) {
  return new LibrdKafkaError(e);
}
