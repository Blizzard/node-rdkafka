/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE.txt file for details.
 */

var Producer = require('../lib/producer');
var t = require('assert');

module.exports = {
  'Producer reconnect': {
    'does not duplicate delivery reports after failed connections': function(cb) {
      this.timeout(30000);

      // librdkafka's in-process mock cluster exercises the real native callback
      // dispatcher and delivery reports without an external Kafka service.
      var client = new Producer({
        'test.mock.num.brokers': 1,
        'dr_cb': true
      });
      var metadata = client.getMetadata;
      var failure = new Error('metadata request failed');
      var attempts = 0;
      var reports = 0;

      client.on('delivery-report', function(err) {
        t.ifError(err);
        reports++;
      });

      client.getMetadata = function(options, next) {
        // Fail after the native connection has been created, as happens when
        // brokers remain unreachable during the initial metadata request.
        setImmediate(function() { next(failure); });
      };

      function finish(err) {
        client.disconnect(function() { cb(err); });
      }

      function produce(expected) {
        var flushed = false;
        var delivered = false;

        function verify() {
          if (!flushed || !delivered) {
            return;
          }

          // Let the native dispatcher finish calling every registered copy.
          setImmediate(function() {
            try {
              t.strictEqual(reports, expected);
            } catch (e) {
              return finish(e);
            }

            if (expected === 2) {
              return finish();
            }

            client.disconnect(function() {
              client.connect({}, function(err) {
                if (err) {
                  return finish(err);
                }
                produce(2);
              });
            });
          });
        }

        client.once('delivery-report', function() {
          delivered = true;
          verify();
        });
        client.produce('reconnect', 0, Buffer.from('message'));
        client.flush(5000, function(err) {
          if (err) {
            return finish(err);
          }
          flushed = true;
          verify();
        });
      }

      function connect() {
        client.connect({}, function(err) {
          if (++attempts <= 3) {
            try {
              t.strictEqual(err.message, failure.message);
            } catch (e) {
              return finish(e);
            }

            if (attempts === 3) {
              client.getMetadata = metadata;
            }
            return connect();
          }

          if (err) {
            return finish(err);
          }
          produce(1);
        });
      }

      connect();
    }
  }
};
