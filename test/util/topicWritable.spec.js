/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var TopicWritable = require('../../lib/util/topicWritable');
var t = require('assert');
var Readable = require('stream').Readable;
var Emitter = require('events');

var fakeClient;

module.exports = {
  'TopicWritable stream': {
    'beforeEach': function() {
      fakeClient = new Emitter();
      fakeClient.isConnected = function() {
        return true;
      };
      fakeClient.Topic = function(name) {
        return {
          topicName: name
        };
      };
      fakeClient.connect = function(opts, cb) {
        setImmediate(function() {
          this.emit('ready');
        }.bind(this));
        return this;
      };
      fakeClient.poll = function() {
        return this;
      };
      fakeClient.setPollInterval = function() {
        return this;
      };
    },

    'exports a stream class': function() {
      t.equal(typeof(TopicWritable), 'function');
    },

    'can be instantiated': function() {
      t.equal(typeof new TopicWritable(fakeClient, 'topic', {}), 'object');
    },

    'properly reads off the fake client': function(done) {
      var message;

      fakeClient.produce = function(topic, partition, message, key) {
        t.equal('topic', topic);
        t.equal(message.toString(), 'Awesome');
        t.equal(Buffer.isBuffer(message), true);
        done();
      };

      var stream = new TopicWritable(fakeClient, 'topic', {});
      stream.on('error', function(err) {
        t.fail(err);
      });

      stream.write(new Buffer('Awesome'));
    },

    'can be given a topic config': function(done) {
      var message;

      fakeClient.produce = function(topic, partition, message, key) {
        t.deepEqual({ topicName: 'topic' }, topic);
        t.equal(message.toString(), 'Awesome');
        t.equal(Buffer.isBuffer(message), true);
        done();
      };

      var stream = new TopicWritable(fakeClient, 'topic', {
        topicOptions: {
          'acks': true
        }
      });
      stream.on('error', function(err) {
        t.fail(err);
      });

      stream.write(new Buffer('Awesome'));
    },

    'properly handles queue errors': function(done) {

      var message;

      var first = true;

      fakeClient.produce = function(topic, partition, message, key) {
        t.equal('topic', topic);
        t.equal(message.toString(), 'Awesome');
        t.equal(Buffer.isBuffer(message), true);
        if (first) {
          first = false;
          var err = new Error('Queue full');
          err.code = -184;
          throw err;
        } else {
          done();
        }
      };

      var stream = new TopicWritable(fakeClient, 'topic', {});
      stream.on('error', function(err) {
        t.fail(err);
      });

      stream.write(new Buffer('Awesome'));
    },

    'properly reads more than one message in order': function(done) {

      var message;
      var currentMessage = 0;

      fakeClient.produce = function(topic, partition, message, key) {
        currentMessage++;
        t.equal('topic', topic);
        t.equal(message.toString(), 'Awesome' + currentMessage);
        t.equal(Buffer.isBuffer(message), true);
        if (currentMessage === 2) {
          done();
        }
      };

      var stream = new TopicWritable(fakeClient, 'topic', {});
      stream.on('error', function(err) {
        t.fail(err);
      });

      stream.write(new Buffer('Awesome1'));
      stream.write(new Buffer('Awesome2'));
    },

    'can be piped into a readable': function(done) {

      var message;
      var currentMessage = 0;
      var iteration = 0;

      var readable = new Readable({
        read: function(size) {
          iteration++;
          if (iteration > 1) {

          } else {
            this.push('Awesome1');
            this.push('Awesome2');
          }
        }
      });

      fakeClient.produce = function(topic, partition, message, key) {
        currentMessage++;
        t.equal('topic', topic);
        t.equal(message.toString(), 'Awesome' + currentMessage);
        t.equal(Buffer.isBuffer(message), true);
        if (currentMessage === 2) {
          done();
        }
      };

      var stream = new TopicWritable(fakeClient, 'topic', {});
      stream.on('error', function(err) {
        t.fail(err);
      });

      readable.pipe(stream);
    },

  },
};
