/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

describe('Transactional Producer', function () {
  var TRANSACTIONS_TIMEOUT_MS = 30000;
  var r = Date.now() + '_' + Math.round(Math.random() * 1000);
  var topicIn = 'transaction_input_' + r;
  var topicOut = 'transaction_output_' + r;

  var producerTras;
  var consumerTrans;

  before(function (done) {
    /*
    prepare: 
    transactional consumer (read from input topic)
    transactional producer (write to output topic)
    write 3 messages to input topic: A, B, C
        A will be skipped, B will be committed, C will be aborted
    */
    var connecting = 3;
    var producerInput;
    function connectedCb(err) {
      if (err) {
        done(err);
        return;
      }
      connecting--;
      if (connecting === 0) {
        producerInput.produce(topicIn, -1, Buffer.from('A'));
        producerInput.produce(topicIn, -1, Buffer.from('B'));
        producerInput.produce(topicIn, -1, Buffer.from('C'));
        producerInput.disconnect(function (err) {
          consumerTrans.subscribe([topicIn]);
          done(err);
        })
      }
    }
    producerInput = Kafka.Producer({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList,
      'enable.idempotence': true
    });
    producerInput.setPollInterval(100);
    producerInput.connect({}, connectedCb);

    producerTras = new Kafka.Producer({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList,
      'dr_cb': true,
      'debug': 'all',
      'transactional.id': 'noderdkafka_transactions_send_offset',
      'enable.idempotence': true
    });
    producerTras.setPollInterval(100);
    producerTras.connect({}, connectedCb);

    consumerTrans = new Kafka.KafkaConsumer({
      'metadata.broker.list': kafkaBrokerList,
      'group.id': 'gropu_transaction_consumer',
      'enable.auto.commit': false
    }, {
      'auto.offset.reset': 'earliest',
    });
    consumerTrans.connect({}, connectedCb);
  });

  after(function (done) {
    let connected = 2;
    function execDisconnect(client) {
      if (!client.isConnected) {
        connected--;
        if (connected === 0) {
          done();
        }
      } else {
        client.disconnect(function() {
          connected--;
          if (connected === 0) {
            done();
          }
        });
      }
    }
    execDisconnect(producerTras);
    execDisconnect(consumerTrans);
  });

  it('should init transactions', function(done) {
    producerTras.initTransactions(TRANSACTIONS_TIMEOUT_MS, function (err) {
      done(err);
    });
  });

  it('should complete transaction', function(done) {
    function readMessage() {
      consumerTrans.consume(1, function(err, m) {
        if (err) {
          done(err);
          return;
        }
        if (m.length === 0) {
          readMessage();
        } else {
          var v = m[0].value.toString();
          if (v === 'A') { // skip first message
            readMessage();
            return;
          }
          if (v !== 'B') {
            done('Expected B');
            return;
          }
          producerTras.beginTransaction(function (err) {
            if (err) {
              done(err);
              return;
            }
            producerTras.produce(topicOut, -1, Buffer.from(v));
            var position = consumerTrans.position();
            producerTras.sendOffsetsToTransaction(position, consumerTrans, function(err) {
              if (err) {
                done(err);
                return;
              }
              producerTras.commitTransaction(function(err) {
                if (err) {
                  done(err);
                  return;
                }
                consumerTrans.committed(5000, function(err, tpo) {
                  if (err) {
                    done(err);
                    return;
                  }
                  if (JSON.stringify(position) !== JSON.stringify(tpo)) {
                    done('Committed mismatch');
                    return;
                  }
                  done();
                });
              });
            });
          });
        }
      });
    }
    readMessage();
  });

  describe('abort transaction', function() {
    var lastConsumerTransPosition;
    before(function(done) {
      function readMessage() {
        consumerTrans.consume(1, function(err, m) {
          if (err) {
            done(err);
            return;
          }
          if (m.length === 0) {
            readMessage();
          } else {
            var v = m[0].value.toString();
            if (v !== 'C') {
              done('Expected C');
              return;
            }
            producerTras.beginTransaction(function (err) {
              if (err) {
                done(err);
                return;
              }
              producerTras.produce(topicOut, -1, Buffer.from(v));
              lastConsumerTransPosition = consumerTrans.position();
              producerTras.sendOffsetsToTransaction(lastConsumerTransPosition, consumerTrans, function(err) {
                if (err) {
                  done(err);
                  return;
                }
                done();
              });
            });
          }
        });
      }
      readMessage();
    });

    it ('should consume committed and uncommitted for read_uncommitted', function(done) {
      var allMsgs = [];
      var consumer = new Kafka.KafkaConsumer({
        'metadata.broker.list': kafkaBrokerList,
        'group.id': 'group_read_uncommitted',
        'enable.auto.commit': false,
        'isolation.level': 'read_uncommitted'
      }, {
        'auto.offset.reset': 'earliest',
      });
      consumer.connect({}, function(err) {
        if (err) {
          done(err);
          return;
        }
        consumer.subscribe([topicOut]);
        consumer.consume();
      });
      consumer.on('data', function(msg) {
        var v = msg.value.toString();
        allMsgs.push(v);
        // both B and C must be consumed
        if (allMsgs.length === 2 && allMsgs[0] === 'B' && allMsgs[1] === 'C') {
          consumer.disconnect(function(err) {
            if (err) {
              done(err);
              return;
            }
            done();
          })
        }
      });
    });

    it ('should consume only committed for read_committed', function(done) {
      var allMsgs = [];
      var consumer = new Kafka.KafkaConsumer({
        'metadata.broker.list': kafkaBrokerList,
        'group.id': 'group_read_committed',
        'enable.partition.eof': true,
        'enable.auto.commit': false,
        'isolation.level': 'read_committed'
      }, {
        'auto.offset.reset': 'earliest',
      });
      consumer.connect({}, function(err) {
        if (err) {
          done(err);
          return;
        }
        consumer.subscribe([topicOut]);
        consumer.consume();
      });
      consumer.on('data', function(msg) {
        var v = msg.value.toString();
        allMsgs.push(v);
      });
      consumer.on('partition.eof', function(eof) {
        if (allMsgs.length === 1 && allMsgs[0] === 'B') {
          consumer.disconnect(function(err) {
            if (err) {
              done(err);
              return;
            }
            done();
          })
        } else {
          done('Expected only B');
          return;
        }
      });
    });

    it('should abort transaction', function(done) {
      producerTras.abortTransaction(function(err) {
        if (err) {
          done(err);
          return;
        }
        consumerTrans.committed(5000, function(err, tpo) {
          if (err) {
            done(err);
            return;
          }
          if (lastConsumerTransPosition[0].offset <= tpo[0].offset) {
            done('Committed mismatch');
            return;
          }
          done();
        });
      });
    });

    it('should consume only committed', function(done) {
      var gotB = false;
      var consumer = new Kafka.KafkaConsumer({
        'metadata.broker.list': kafkaBrokerList,
        'group.id': 'group_default',
        'enable.partition.eof': true,
        'enable.auto.commit': false,
      }, {
        'auto.offset.reset': 'earliest',
      });
      consumer.connect({}, function(err) {
        if (err) {
          done(err);
          return;
        }
        consumer.subscribe([topicOut]);
        consumer.consume();
      });
      consumer.on('data', function(msg) {
        var v = msg.value.toString();
        if (v !== 'B') {
          done('Expected B');
          return;
        }
        gotB = true;
      });
      consumer.on('partition.eof', function(eof) {
        if (!gotB) {
          done('Expected B');
          return;
        }
        consumer.disconnect(function(err) {
          if (err) {
            done(err);
            return;
          }
          done();
        });
      });
    });
  });
});
