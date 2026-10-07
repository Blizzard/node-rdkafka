/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var net = require('net');
var Producer = require('../lib/producer');
var LibrdKafkaError = require('../lib/error');
var t = require('assert');

// Minimal fake broker speaking only Metadata v0. It answers one request with
// itself as the only broker, so librdkafka learns a real (non-bootstrap)
// broker, and is then shut down. librdkafka raises ERR__ALL_BROKERS_DOWN
// only in that situation, as it does when a real cluster becomes unreachable.
function startFakeBroker(cb) {
  var sockets = [];
  var server = net.createServer(function(socket) {
    sockets.push(socket);
    socket.on('error', function() {});
    var pending = Buffer.alloc(0);
    socket.on('data', function(data) {
      pending = Buffer.concat([pending, data]);
      // size(4) apiKey(2) apiVersion(2) correlationId(4) ...
      // librdkafka may pipeline several requests in one chunk.
      while (pending.length >= 4 && pending.length >= 4 + pending.readInt32BE(0)) {
        var frame = pending.slice(0, 4 + pending.readInt32BE(0));
        pending = pending.slice(frame.length);
        if (frame.readInt16BE(4) !== 3) {
          continue;
        }
        var host = Buffer.from('127.0.0.1');
        var body = Buffer.alloc(4 + 4 + 4 + 2 + host.length + 4 + 4);
        var o = 0;
        o = body.writeInt32BE(frame.readInt32BE(8), o); // correlation id
        o = body.writeInt32BE(1, o); // brokers: 1
        o = body.writeInt32BE(0, o); // node id
        o = body.writeInt16BE(host.length, o);
        o += host.copy(body, o);
        o = body.writeInt32BE(server.address().port, o);
        body.writeInt32BE(0, o); // topics: 0
        var size = Buffer.alloc(4);
        size.writeInt32BE(body.length, 0);
        socket.write(Buffer.concat([size, body]));
      }
    });
  });

  server.listen(0, '127.0.0.1', function() {
    cb(server, function stop() {
      sockets.forEach(function(s) { s.destroy(); });
      server.close();
    });
  });
}

module.exports = {
  'event.error': {
    'keeps the numeric librdkafka error code': function(cb) {
      startFakeBroker(function(server, stop) {
        var client = new Producer({
          'client.id': 'kafka-mocha-event-error',
          'metadata.broker.list': '127.0.0.1:' + server.address().port,
          'api.version.request': false,
          'broker.version.fallback': '0.9.0',
          'reconnect.backoff.max.ms': 100,
          'socket.keepalive.enable': true
        }, {});

        var done = false;
        var timer;
        var finish = function(err) {
          if (done) {
            return;
          }
          done = true;
          clearTimeout(timer);
          stop();
          client.disconnect(function() {
            cb(err);
          });
        };

        timer = setTimeout(function() {
          finish(new Error('Timed out waiting for ERR__ALL_BROKERS_DOWN'));
        }, 20000);

        client.on('event.error', function(err) {
          if (err.code === LibrdKafkaError.codes.ERR__ALL_BROKERS_DOWN) {
            try {
              t.strictEqual(err.errno, err.code);
              t.strictEqual(err.origin, 'local');
              t.strictEqual(typeof err.isFatal, 'boolean');
            } catch (e) {
              return finish(e);
            }
            return finish();
          }
          // Other errors (e.g. ERR__TRANSPORT) can arrive first. They must
          // carry their real code and not fall back to -1.
          if (err.code === LibrdKafkaError.codes.ERR_UNKNOWN) {
            finish(new Error('event.error lost its code: ' + err.message));
          }
        });

        client.connect({}, function(err) {
          if (err) {
            return finish(err);
          }
          // connected and the broker is known; now make it unreachable
          stop();
        });
        client.setPollInterval(50);
      });
    }
  }
};
