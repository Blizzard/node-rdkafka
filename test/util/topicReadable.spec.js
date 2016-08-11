/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var TopicReadable = require('../../lib/util/topicReadable');
var t = require('assert');
var Writable = require('stream').Writable;
var Emitter = require('events');

var fakeClient;

module.exports = {
  'TopicReadable stream': {
    'beforeEach': function() {
      fakeClient = new Emitter();
      fakeClient.isConnected = function() {
        return true;
      };
      fakeClient.consume = function(size, cb) {
        if (!size) {
          cb = size;
        }

        t.equal(typeof cb, 'function',
          'Provided callback should always be a function');
        setImmediate(function() {
          cb(null, {
            message: new Buffer('test'),
            offset: 1
          });
        });
      };
      fakeClient.subscribe = function(topics) {
        t.equal(Array.isArray(topics), true);
        return this;
      };
    },

    'exports a stream class': function() {
      t.equal(typeof(TopicReadable), 'function');
    },

    'can be instantiated': function() {
      t.equal(typeof new TopicReadable(fakeClient, 'topic', {}), 'object');
    },

    'properly reads off the fake client': function(cb) {
      var stream = new TopicReadable(fakeClient, 'topic', {});
      stream.on('error', function(err) {
        t.fail(err);
      });
      stream.once('readable', function() {
        var message = stream.read();
        t.notEqual(message, null);
        t.ok(Buffer.isBuffer(message.message));
        t.equal('test', message.message.toString());
        t.equal(typeof message.offset, 'number');
        stream.pause();
        cb();
      });
    },

    'properly reads correct number of messages but does not stop': function(next) {
      var numMessages = 10;
      var numReceived = 0;
      var numSent = 0;

      fakeClient.consume = function(size, cb) {
        if (numSent < numMessages) {
          numSent++;
          setImmediate(function() {
            cb(null, {
              message: new Buffer('test'),
              offset: 1
            });
          });
        } else {
        }
      };
      var stream = new TopicReadable(fakeClient, 'topic', {});
      stream.on('error', function(err) {
        // Ignore
      });
      stream.on('readable', function() {
        var message = stream.read();
        numReceived++;
        t.notEqual(message, null);
        t.ok(Buffer.isBuffer(message.message));
        t.equal(typeof message.offset, 'number');
        if (numReceived === numMessages) {
          // give it a second to get an error
          next();
        }
      });
    },

    'can be piped around': function(cb) {
      var stream = new TopicReadable(fakeClient, 'topic', {});
      var writable = new Writable({
        write: function(message, encoding, next) {
          t.notEqual(message, null);
          t.ok(Buffer.isBuffer(message.message));
          t.equal(typeof message.offset, 'number');
          this.cork();
          cb();
        },
        objectMode: true
      });

      stream.pipe(writable);
      stream.on('error', function(err) {
        t.fail(err);
      });

    }

  },
};
