/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var crypto = require('crypto');
var t = require('assert');

var Kafka = require('../');
var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';
var eventListener = require('./listener');
var topic = 'test';
var topic2 = 'test2';

describe('Consumer/Producer', function() {

  var producer;
  var consumer;

  beforeEach(function(done) {
    var finished = 0;
    var called = false;

    function maybeDone(err) {
      if (called) {
        return;
      }

      finished++;
      if (err) {
        called = true;
        return done(err);
      }

      if (finished === 2) {
        done();
      }
    }

    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');

    consumer = new Kafka.KafkaConsumer({
      'metadata.broker.list': kafkaBrokerList,
      'group.id': grp,
      'fetch.wait.max.ms': 1000,
      'session.timeout.ms': 10000,
      'enable.auto.commit': true,
      'enable.partition.eof': true,
      'debug': 'all'
      // paused: true,
    }, {
      'auto.offset.reset': 'largest'
    });

    consumer.connect({}, function(err, d) {
      t.ifError(err);
      t.equal(typeof d, 'object', 'metadata should be returned');
      maybeDone(err);
    });

    eventListener(consumer);

    producer = new Kafka.Producer({
      'client.id': 'kafka-mocha',
      'metadata.broker.list': kafkaBrokerList,
      'fetch.wait.max.ms': 1,
      'debug': 'all',
      'dr_cb': true
    }, {
      'produce.offset.report': true
    });

    producer.connect({}, function(err, d) {
      t.ifError(err);
      t.equal(typeof d, 'object', 'metadata should be returned');
      maybeDone(err);
    });

    eventListener(producer);

  });

  afterEach(function(done) {
    var finished = 0;
    var called = false;

    function maybeDone(err) {
      if (called) {
        return;
      }

      finished++;
      if (err) {
        called = true;
        return done(err);
      }

      if (finished === 2) {
        done();
      }
    }

    consumer.disconnect(function(err) {
      maybeDone(err);
    });

    producer.disconnect(function(err) {
      maybeDone(err);
    });
  });

  it('should be able to produce, consume messages, read position: subscribe/consumeOnce', function(done) {
    crypto.randomBytes(4096, function(ex, buffer) {
      producer.setPollInterval(10);

      var offset;

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
        offset = report.offset;
      });

      consumer.setDefaultConsumeTimeout(10);
      consumer.subscribe([topic]);

      var ct;

      var consumeOne = function() {
        consumer.consume(1, function(err, messages) {
          if (err && err.code === -185) {
            ct = setTimeout(consumeOne, 100);
            return;
          } else if (messages.length === 0 || (err && err.code === -191)) {
            producer.produce(topic, null, buffer, null);
            ct = setTimeout(consumeOne, 100);
            return;
          } else if (err) {
            return;
          }

          var message = messages[0];

          t.equal(Array.isArray(consumer.assignments()), true, 'Assignments should be an array');
          t.equal(consumer.assignments().length > 0, true, 'Should have at least one assignment');
          t.equal(buffer.toString(), message.value.toString(),
            'message is not equal to buffer');

          // test consumer.position as we have consumed
          var position = consumer.position();
          t.equal(position.length, 1);
          t.deepStrictEqual(position[0].partition, 0);
          t.ok(position[0].offset >= 0);
          done();
        });
      };

      // Consume until we get it or time out
      consumeOne();

    });
  });
  
  it('should return ready messages on partition EOF', function(done) {
    crypto.randomBytes(4096, function(ex, buffer) {
      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
      });

      consumer.subscribe([topic]);

      var consumeAll = function() {
        // Make sure we get the message fast when consuming with large timeout
        consumer.setDefaultConsumeTimeout(1000000);
        consumer.consume(100000, function(err, messages) {
          t.ifError(err);
          t.equal(messages.length, 1);
          done();
        });
      };

      var consumeNone = function() {
        // With no new messages, the consume should wait whole timeout
        var start = Date.now();
        // Set the timeout to 2000ms to see that it actually waits the whole time
        // (Needs to be higher than fetch.max.wait.ms which is 1000 here
        // to ensure we don't only wait that long)
        consumer.setDefaultConsumeTimeout(2000);
        consumer.consume(100000, function(err, messages) {
          t.ifError(err);
          t.ok(Date.now() - start >= 1998);
          t.equal(messages.length, 0);

          // Produce one message to cause EOF with waiting message when consuming all
          producer.produce(topic, null, buffer, null);
          consumeAll();
        });
      };

      consumeNone();
    });
  });

  it('should emit partition.eof event when reaching end of partition', function(done) {
    crypto.randomBytes(4096, function(ex, buffer) {
      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
      });

      consumer.subscribe([topic]);

      var events = [];

      consumer.once('data', function(msg) {
        events.push("data");
      });
      
      consumer.once('partition.eof', function(eof) {
        events.push("partition.eof");
      });

      setTimeout(function() {
        producer.produce(topic, null, buffer, null);
      }, 500)
      consumer.setDefaultConsumeTimeout(2000);
      consumer.consume(1000, function(err, messages) {
        t.ifError(err);
        t.equal(messages.length, 1);
        t.deepStrictEqual(events, ["data", "partition.eof"]);
        done();
      });
    });
  });

  it('should emit partition.eof when already at end of partition', function(done) {
    crypto.randomBytes(4096, function(ex, buffer) {
      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
      });

      consumer.subscribe([topic]);

      var events = [];

      consumer.once('data', function(msg) {
        events.push("data");
      });

      consumer.on('partition.eof', function(eof) {
        events.push("partition.eof");
      });

      setTimeout(function() {
        producer.produce(topic, null, buffer, null);
      }, 2000)
      consumer.setDefaultConsumeTimeout(3000);
      consumer.consume(1000, function(err, messages) {
        t.ifError(err);
        t.equal(messages.length, 1);
        t.deepStrictEqual(events, ["partition.eof", "data", "partition.eof"]);
        done();
      });
    });
  });

  it('should be able to produce and consume messages: consumeLoop', function(done) {
    var key = 'key';

    crypto.randomBytes(4096, function(ex, buffer) {

      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        if (!err) {
          t.equal(topic, report.topic, 'invalid delivery-report topic');
          t.equal(key, report.key, 'invalid delivery-report key');
          t.ok(report.offset >= 0, 'invalid delivery-report offset');
        }
      });

      consumer.on('data', function(message) {
        t.equal(buffer.toString(), message.value.toString(), 'invalid message value');
        t.equal(key, message.key, 'invalid message key');
        t.equal(topic, message.topic, 'invalid message topic');
        t.ok(message.offset >= 0, 'invalid message offset');
        done();
      });

      consumer.subscribe([topic]);
      consumer.consume();

      setTimeout(function() {
        producer.produce(topic, null, buffer, key);
      }, 2000);

    });
  });

  it('should emit \'partition.eof\' events in consumeLoop', function(done) {

    crypto.randomBytes(4096, function(ex, buffer) {
      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        t.ifError(err);
      });


      var events = [];
      var offsets = [];

      consumer.on('data', function(message) {
        t.equal(message.topic, topic);
        t.equal(message.partition, 0);
        offsets.push(message.offset);
        events.push('data');
      });

      consumer.on('partition.eof', function(eofEvent) {
        t.equal(eofEvent.topic, topic);
        t.equal(eofEvent.partition, 0);
        offsets.push(eofEvent.offset);
        events.push('partition.eof');
      });

      consumer.subscribe([topic]);
      consumer.consume();

      setTimeout(function() {
        producer.produce(topic, null, buffer);
      }, 2000);

      setTimeout(function() {
        producer.produce(topic, null, buffer);
      }, 4000);

      setTimeout(function() {
        t.deepStrictEqual(events, ['partition.eof', 'data', 'partition.eof', 'data', 'partition.eof']);
        var startOffset = offsets[0];
        t.deepStrictEqual(offsets,
          [ startOffset,
            startOffset,
            startOffset + 1,
            startOffset + 1,
            startOffset + 2 ]);
        done();
      }, 6000);
    });
  });

  it('should emit [warning] event on UNKNOWN_TOPIC_OR_PART error: consumeLoop', function(done) {
    consumer.on('warning', function (err) {
      if (err.code === Kafka.CODES.ERRORS.ERR_UNKNOWN_TOPIC_OR_PART) {
        consumer.disconnect(function() {
          done();
        });
      } else {
        t.ifError(err);
      }
    });

    consumer.subscribe(['non_existing_topic']);
    consumer.consume();
  });

  it('should be able to produce and consume messages with one header value as string: consumeLoop', function(done) {
    var headers = [
      { key: "value" }
    ];
    run_headers_test(done, headers);
  });

  it('should be able to produce and consume messages with one header value as buffer: consumeLoop', function(done) {
    var headers = [
      { key: Buffer.from('value') }
    ];
    run_headers_test(done, headers);
  });

  it('should be able to produce and consume messages with one header value as int: consumeLoop', function(done) {
    var headers = [
      { key: 10 }
    ];
    run_headers_test(done, headers);
  });

  it('should be able to produce and consume messages with one header value as float: consumeLoop', function(done) {
    var headers = [
      { key: 1.11 }
    ];
    run_headers_test(done, headers);
  });

  it('should be able to produce and consume messages with multiple headers value as buffer: consumeLoop', function(done) {
    var headers = [
      { key1: Buffer.from('value1') },
      { key2: Buffer.from('value2') },
      { key3: Buffer.from('value3') },
      { key4: Buffer.from('value4') },
    ];
    run_headers_test(done, headers);
  });
  
  it('should be able to produce and consume messages with multiple headers value as string: consumeLoop', function(done) {
    var headers = [
      { key1: 'value1' },
      { key2: 'value2' },
      { key3: 'value3' },
      { key4: 'value4' },
    ];
    run_headers_test(done, headers);
  });

  it('should be able to produce and consume messages with multiple headers with mixed values: consumeLoop', function(done) {
    var headers = [
      { key1: 'value1' },
      { key2: Buffer.from('value2') },
      { key3: 100 },
      { key4: 10.1 },
    ];
    run_headers_test(done, headers);
  });

  it('should be able to produce and consume messages: empty buffer key and empty value', function(done) {
    var emptyString = '';
    var key = Buffer.from(emptyString);
    var value = Buffer.from('');

    producer.setPollInterval(10);

    consumer.once('data', function(message) {
      t.notEqual(message.value, null, 'message should not be null');
      t.equal(value.toString(), message.value.toString(), 'invalid message value');
      t.equal(emptyString, message.key, 'invalid message key');
      done();
    });

    consumer.subscribe([topic]);
    consumer.consume();

    setTimeout(function() {
      producer.produce(topic, null, value, key);
    }, 2000);
  });

  it('should be able to produce and consume messages: empty key and empty value', function(done) {
    var key = '';
    var value = Buffer.from('');

    producer.setPollInterval(10);

    consumer.once('data', function(message) {
      t.notEqual(message.value, null, 'message should not be null');
      t.equal(value.toString(), message.value.toString(), 'invalid message value');
      t.equal(key, message.key, 'invalid message key');
      done();
    });

    consumer.subscribe([topic]);
    consumer.consume();

    setTimeout(function() {
      producer.produce(topic, null, value, key);
    }, 2000);
  });

  it('should be able to produce and consume messages: null key and null value', function(done) {
    var key = null;
    var value = null;

    producer.setPollInterval(10);

    consumer.once('data', function(message) {
      t.equal(value, message.value, 'invalid message value');
      t.equal(key, message.key, 'invalid message key');
      done();
    });

    consumer.subscribe([topic]);
    consumer.consume();

    setTimeout(function() {
      producer.produce(topic, null, value, key);
    }, 2000);
  });

  describe('Exceptional case -  offset_commit_cb true', function() {
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');
    var consumerOpts = {
      'metadata.broker.list': kafkaBrokerList,
      'group.id': grp,
      'fetch.wait.max.ms': 1000,
      'session.timeout.ms': 10000,
      'enable.auto.commit': false,
      'debug': 'all',
      'offset_commit_cb': true
    };

    beforeEach(function(done) {
      consumer = new Kafka.KafkaConsumer(consumerOpts, {
        'auto.offset.reset': 'largest',
      });

      consumer.connect({}, function(err, d) {
        t.ifError(err);
        t.equal(typeof d, 'object', 'metadata should be returned');
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should async commit after consuming', function(done) {
      var key = '';
      var value = Buffer.from('');

      var lastOffset = null;

      consumer.once('data', function(message) {
        lastOffset = message.offset;

        // disconnect in offset commit callback
        consumer.on('offset.commit', function(err, offsets) {
          t.ifError(err);
          t.equal(typeof offsets, 'object', 'offsets should be returned');

          consumer.disconnect(function() {
            // reconnect in disconnect callback
            consumer.connect({}, function(err, d) {
              t.ifError(err);
              t.equal(typeof d, 'object', 'metadata should be returned');

              // check that no new messages arrive, as the offset was committed
              consumer.once('data', function(message) {
                done(new Error('Should never be here'));
              });

              consumer.subscribe([topic]);
              consumer.consume();

              setTimeout(function() {
                done();
              }, 5000);
            });
          });
        });

        consumer.commitMessage(message);
      });

      consumer.subscribe([topic]);
      consumer.consume();

      setTimeout(function() {
        producer.produce(topic, null, value, key);
      }, 2000);
    });
  });

  describe('Exceptional case - offset_commit_cb function', function() {
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should callback offset_commit_cb after commit', function(done) {
      var consumerOpts = {
          'metadata.broker.list': kafkaBrokerList,
          'group.id': grp,
          'fetch.wait.max.ms': 1000,
          'session.timeout.ms': 10000,
          'enable.auto.commit': false,
          'debug': 'all',
          'offset_commit_cb': function(offset) {
             done();
        }
      };
      consumer = new Kafka.KafkaConsumer(consumerOpts, {
        'auto.offset.reset': 'largest',
      });
      eventListener(consumer);

      consumer.connect({}, function(err, d) {
        t.ifError(err);
        t.equal(typeof d, 'object', 'metadata should be returned');
        consumer.subscribe([topic]);
        consumer.consume();
        setTimeout(function() {
          producer.produce(topic, null, Buffer.from(''), '');
        }, 2000);
      });

      consumer.once('data', function(message) {
        consumer.commitMessage(message);
      });
    });
  });

  function assert_headers_match(expectedHeaders, messageHeaders) {
    t.equal(expectedHeaders.length, messageHeaders.length, 'Headers length does not match expected length');
    for (var i = 0; i < expectedHeaders.length; i++) {
      var expectedKey = Object.keys(expectedHeaders[i])[0];
      var messageKey = Object.keys(messageHeaders[i]);
      t.equal(messageKey.length, 1, 'Expected only one Header key');
      t.equal(expectedKey, messageKey[0], 'Expected key does not match message key');
      var expectedValue = Buffer.isBuffer(expectedHeaders[i][expectedKey]) ?
                          expectedHeaders[i][expectedKey].toString() :
                          expectedHeaders[i][expectedKey];
      var actualValue = messageHeaders[i][expectedKey].toString();
      t.equal(expectedValue, actualValue, 'invalid message header');
    }
  }

  function run_headers_test(done, headers) {
    var key = 'key';

    crypto.randomBytes(4096, function(ex, buffer) {

      producer.setPollInterval(10);

      producer.once('delivery-report', function(err, report) {
        if (!err) {
          t.equal(topic, report.topic, 'invalid delivery-report topic');
          t.equal(key, report.key, 'invalid delivery-report key');
          t.ok(report.offset >= 0, 'invalid delivery-report offset');
        }
      });

      consumer.on('data', function(message) {
        t.equal(buffer.toString(), message.value.toString(), 'invalid message value');
        t.equal(key, message.key, 'invalid message key');
        t.equal(topic, message.topic, 'invalid message topic');
        t.ok(message.offset >= 0, 'invalid message offset');
        assert_headers_match(headers, message.headers);
        done();
      });

      consumer.subscribe([topic]);
      consumer.consume();

      setTimeout(function() {
        var timestamp = new Date().getTime();
        producer.produce(topic, null, buffer, key, timestamp, "", headers);
      }, 2000);

    });
  }

});
