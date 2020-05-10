/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var ProducerStream = require('../lib/producer-stream');
var t = require('assert');
var Readable = require('stream').Readable;
var Emitter = require('events');

var fakeClient;

module.exports = {
  'ProducerStream stream': {
    'beforeEach': function() {
      fakeClient = new Emitter();

      fakeClient._isConnected = true;
      fakeClient._isConnecting = false;

      fakeClient.isConnected = function() {
        return true;
      };
      fakeClient.connect = function(opts, cb) {
        setImmediate(function() {
          this.emit('ready');
        }.bind(this));
        return this;
      };
      fakeClient.disconnect = function(cb) {
        setImmediate(function() {
          this.emit('disconnected');
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
      t.equal(typeof(ProducerStream), 'function');
    },

    'in buffer mode': {
      'requires a topic be provided when running in buffer mode': function() {
        t.throws(function() {
          var x = new ProducerStream(fakeClient, {});
        });
      },

      'can be instantiated': function() {
        t.equal(typeof new ProducerStream(fakeClient, {
          topic: 'topic'
        }), 'object');
      },

      'does not run connect if the client is already connected': function(cb) {
        fakeClient.connect = function() {
          t.fail('Should not run connect if the client is already connected');
        };

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });

        setTimeout(cb, 10);
      },

      'does run connect if the client is not already connected': function(cb) {
        fakeClient._isConnected = false;
        fakeClient.isConnected = function() {
          return false;
        };

        fakeClient.once('ready', cb);

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
      },

      'forwards connectOptions to client options when provided': function(cb) {
        var testClientOptions = { timeout: 3000 };

        fakeClient._isConnected = false;
        fakeClient.isConnected = function() {
          return false;
        };
        var fakeConnect = fakeClient.connect;
        fakeClient.connect = function(opts, callback) {
          t.deepEqual(opts, testClientOptions);
          cb();
        };

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic',
          connectOptions: testClientOptions
        });
      },

      'automatically disconnects when autoclose is not provided': function(cb) {
        fakeClient.once('disconnected', cb);

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });

        stream.end();
      },

      'does not automatically disconnect when autoclose is set to false': function(done) {
        fakeClient.once('disconnected', function() {
          t.fail('Should not run disconnect');
        });

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic',
          autoClose: false
        });

        stream.end();

        setTimeout(done, 10);
      },

      'properly reads off the fake client': function(done) {
        var message;

        fakeClient.produce = function(topic, partition, message, key) {
          t.equal('topic', topic);
          t.equal(message.toString(), 'Awesome');
          t.equal(Buffer.isBuffer(message), true);
          done();
        };

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write(Buffer.from('Awesome'));
      },

      'passes a topic string if options are not provided': function(done) {
        var message;

        fakeClient.produce = function(topic, partition, message, key) {
          t.equal('topic', topic);
          t.equal(message.toString(), 'Awesome');
          t.equal(Buffer.isBuffer(message), true);
          done();
        };

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write(Buffer.from('Awesome'));
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

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write(Buffer.from('Awesome'));
      },

      'errors out when a non-queue related error occurs': function(done) {
        fakeClient.produce = function(topic, partition, message, key) {
          var err = new Error('ERR_MSG_SIZE_TOO_LARGE ');
          err.code = 10;
          throw err;
        };

        fakeClient.on('disconnected', function() {
          done();
        });

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.equal(err.code, 10, 'Error was unexpected');
          // This is good
        });

        stream.write(Buffer.from('Awesome'));
      },

      'errors out when a non-queue related error occurs but does not disconnect if autoclose is false': function(done) {
        fakeClient.produce = function(topic, partition, message, key) {
          var err = new Error('ERR_MSG_SIZE_TOO_LARGE ');
          err.code = 10;
          throw err;
        };

        fakeClient.on('disconnected', function() {
          t.fail('Should not try to disconnect');
        });

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic',
          autoClose: false
        });
        stream.on('error', function(err) {
          t.equal(err.code, 10, 'Error was unexpected');
          // This is good
        });

        stream.write(Buffer.from('Awesome'));

        setTimeout(done, 10);
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

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write(Buffer.from('Awesome1'));
        stream.write(Buffer.from('Awesome2'));
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

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        readable.pipe(stream);
      },
      'can drain buffered chunks': function(done) {
        
        var message;
        var currentMessage = 0;

        fakeClient.produce = function(topic, partition, message, key) {
          currentMessage++;
          t.equal('topic', topic);
          t.equal(message.toString(), 'Awesome' + currentMessage);
          t.equal(Buffer.isBuffer(message), true);
          if (currentMessage === 3) {
            done();
          }
        };

        var stream = new ProducerStream(fakeClient, {
          topic: 'topic'
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        fakeClient._isConnected = false;
        fakeClient._isConnecting = true;
        fakeClient.isConnected = function() {
          return false;
        };

        stream.write(Buffer.from('Awesome1'));
        stream.write(Buffer.from('Awesome2'));
        stream.write(Buffer.from('Awesome3'));

        fakeClient._isConnected = true;
        fakeClient._isConnecting = false;
        fakeClient.isConnected = function() {
          return true;
        };
        fakeClient.connect();
      },
    },

    'in objectMode': {
      'can be instantiated': function() {
        t.equal(typeof new ProducerStream(fakeClient, {
          objectMode: true
        }), 'object');
      },

      'properly produces message objects': function(done) {
        var _timestamp = Date.now();
        var _opaque = {
          foo: 'bar'
        };
        var _headers = {
          header: 'header value'
        };

        fakeClient.produce = function(topic, partition, message, key, timestamp, opaque, headers) {
          t.equal('topic', topic);
          t.equal(message.toString(), 'Awesome');
          t.equal(Buffer.isBuffer(message), true);
          t.equal(partition, 10);
          t.equal(key, 'key');
          t.deepEqual(_opaque, opaque);
          t.deepEqual(_timestamp, timestamp);
          t.deepEqual(_headers, headers);
          done();
        };

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write({
          topic: 'topic',
          value: Buffer.from('Awesome'),
          partition: 10,
          key: 'key',
          timestamp: _timestamp,
          opaque: _opaque,
          headers: _headers
        });
      },

      'properly handles queue errors': function(done) {
        var message;

        var first = true;

        fakeClient.produce = function(topic, partition, message, key) {
          t.equal('topic', topic);
          t.equal(message.toString(), 'Awesome');
          t.equal(Buffer.isBuffer(message), true);
          t.equal(partition, 10);
          t.equal(key, 'key');
          if (first) {
            first = false;
            var err = new Error('Queue full');
            err.code = -184;
            throw err;
          } else {
            done();
          }
        };

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write({
          topic: 'topic',
          value: Buffer.from('Awesome'),
          partition: 10,
          key: 'key'
        });
      },

      'errors out when a non-queue related error occurs': function(done) {
        fakeClient.produce = function(topic, partition, message, key) {
          var err = new Error('ERR_MSG_SIZE_TOO_LARGE ');
          err.code = 10;
          throw err;
        };

        fakeClient.on('disconnected', function() {
          done();
        });

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.equal(err.code, 10, 'Error was unexpected');
          // This is good
        });

        stream.write(Buffer.from('Awesome'));
      },

      'errors out when a non-queue related error occurs but does not disconnect if autoclose is false': function(done) {
        fakeClient.produce = function(topic, partition, message, key) {
          var err = new Error('ERR_MSG_SIZE_TOO_LARGE ');
          err.code = 10;
          throw err;
        };

        fakeClient.on('disconnected', function() {
          t.fail('Should not try to disconnect');
        });

        var stream = new ProducerStream(fakeClient, {
          objectMode: true,
          autoClose: false
        });
        stream.on('error', function(err) {
          t.equal(err.code, 10, 'Error was unexpected');
          // This is good
        });

        stream.write({
          value: Buffer.from('Awesome'),
          topic: 'topic'
        });

        setTimeout(done, 10);
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

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        stream.write({
          value: Buffer.from('Awesome1'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome2'),
          topic: 'topic'
        });
      },

      'can be piped into a readable': function(done) {

        var message;
        var currentMessage = 0;
        var iteration = 0;

        var readable = new Readable({
          objectMode: true,
          read: function(size) {
            iteration++;
            if (iteration > 1) {

            } else {
              this.push({
                topic: 'topic',
                value: Buffer.from('Awesome1')
              });
              this.push({
                topic: 'topic',
                value: Buffer.from('Awesome2')
              });
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

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        readable.pipe(stream);
      },

      'can drain buffered messages': function(done) {

        var message;
        var currentMessage = 0;

        fakeClient.produce = function(topic, partition, message, key) {
          currentMessage++;
          t.equal('topic', topic);
          t.equal(message.toString(), 'Awesome' + currentMessage);
          t.equal(Buffer.isBuffer(message), true);
          if (currentMessage === 3) {
            done();
          }
        };

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        fakeClient._isConnected = false;
        fakeClient._isConnecting = true;
        fakeClient.isConnected = function() {
          return false;
        };

        stream.write({
          value: Buffer.from('Awesome1'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome2'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome3'),
          topic: 'topic'
        });

        fakeClient._isConnected = true;
        fakeClient._isConnecting = false;
        fakeClient.isConnected = function() {
          return true;
        };
        fakeClient.connect();
      },

      'properly handles queue errors while draining': function(done) {
        var message;
        var currentMessage = 0;

        fakeClient.produce = function(topic, partition, message, key) {
          currentMessage++;
          if (currentMessage === 3) {
            var err = new Error('Queue full');
            err.code = -184;
            throw err;
          } else if (currentMessage === 4) {
            done();
          }
        };

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.fail(err);
        });

        fakeClient._isConnected = false;
        fakeClient._isConnecting = true;
        fakeClient.isConnected = function() {
          return false;
        };

        stream.write({
          value: Buffer.from('Awesome1'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome2'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome3'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome4'),
          topic: 'topic'
        });

        fakeClient._isConnected = true;
        fakeClient._isConnecting = false;
        fakeClient.isConnected = function() {
          return true;
        };
        fakeClient.connect();
      },

      'errors out for non-queue related errors while draining': function (done) {
        var currentMessage = 0;

        fakeClient.produce = function(topic, partition, message, key) {
          currentMessage++;
          if (currentMessage === 3) {
            var err = new Error('ERR_MSG_SIZE_TOO_LARGE ');
            err.code = 10;
            throw err;
          }
        };

        fakeClient.on('disconnected', function() {
          done();
        });

        var stream = new ProducerStream(fakeClient, {
          objectMode: true
        });
        stream.on('error', function(err) {
          t.equal(err.code, 10, 'Error was unexpected');
          // This is good
        });

        fakeClient._isConnected = false;
        fakeClient._isConnecting = true;
        fakeClient.isConnected = function() {
          return false;
        };

        stream.write({
          value: Buffer.from('Awesome1'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome2'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome3'),
          topic: 'topic'
        });
        stream.write({
          value: Buffer.from('Awesome4'),
          topic: 'topic'
        });

        fakeClient._isConnected = true;
        fakeClient._isConnecting = false;
        fakeClient.isConnected = function() {
          return true;
        };
        fakeClient.connect();
      },

    }

  }
};
