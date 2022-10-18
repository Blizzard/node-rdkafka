/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var t = require('assert');
var crypto = require('crypto');

var eventListener = require('./listener');

var cooperativeRebalanceCallback = require('../lib/kafka-consumer').cooperativeRebalanceCallback;
var KafkaConsumer = require('../').KafkaConsumer;
var AdminClient = require('../').AdminClient;
var LibrdKafkaError = require('../lib/error');

var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';

describe('Consumer', function() {
  var gcfg;

  beforeEach(function() {
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');
     gcfg = {
      'bootstrap.servers': kafkaBrokerList,
      'group.id': grp,
      'debug': 'all',
      'rebalance_cb': true,
      'enable.auto.commit': false
    };
  });

  describe('commit', function() {
    var topic = 'test';
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    it('should allow commit with an array', function(done) {
      consumer.commit([{ topic: topic, partition: 0, offset: -1 }]);
      done();
    });

    it('should allow commit without an array', function(done) {
      consumer.commit({ topic: topic, partition: 0, offset: -1 });
      done();
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });
  });

  describe('committed and position', function() {
    var topic = 'test';
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('before assign, committed offsets are empty', function(done) {
      consumer.committed(null, 1000, function(err, committed) {
        t.ifError(err);
        t.equal(Array.isArray(committed), true, 'Committed offsets should be an array');
        t.equal(committed.length, 0);
        done();
      });
    });

    it('before assign, position returns an empty array', function() {
      var position = consumer.position();
      t.equal(Array.isArray(position), true, 'Position should be an array');
      t.equal(position.length, 0);
    });

    it('after assign, should get committed array without offsets ', function(done) {
      var topic = 'test';
      consumer.assign([{topic:topic, partition:0}]);
      // Defer this for a second
      setTimeout(function() {
        consumer.committed(null, 1000, function(err, committed) {
          t.ifError(err);
          t.equal(committed.length, 1);
          t.equal(typeof committed[0], 'object', 'TopicPartition should be an object');
          t.deepStrictEqual(committed[0].partition, 0);
          t.equal(committed[0].offset, undefined);
          done();
        });
      }, 1000);
    });

    it('after assign and commit, should get committed offsets', function(done) {
      var topic = 'test';
      consumer.assign([{topic:topic, partition:0}]);
      consumer.commitSync({topic:topic, partition:0, offset:1000});
      consumer.committed(null, 1000, function(err, committed) {
        t.ifError(err);
        t.equal(committed.length, 1);
        t.equal(typeof committed[0], 'object', 'TopicPartition should be an object');
        t.deepStrictEqual(committed[0].partition, 0);
        t.deepStrictEqual(committed[0].offset, 1000);
        done();
      });
    });

    it('after assign, before consume, position should return an array without offsets', function(done) {
      var topic = 'test';
      consumer.assign([{topic:topic, partition:0}]);
      var position = consumer.position();
      t.equal(Array.isArray(position), true, 'Position should be an array');
      t.equal(position.length, 1);
      t.equal(typeof position[0], 'object', 'TopicPartition should be an object');
      t.deepStrictEqual(position[0].partition, 0);
      t.equal(position[0].offset, undefined, 'before consuming, offset is undefined');
      // see both.spec.js 'should be able to produce, consume messages, read position...'
      // for checking of offset numeric value
      done();
    });

    it('should obey the timeout', function(done) {
      consumer.committed(null, 0, function(err, committed) {
        if (!err) {
          t.fail(err, 'not null', 'Error should be set for a timeout');
        }
        done();
      });
    });

  });

  describe('seek and positioning', function() {
    var topic = 'test';
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        consumer.assign([{
          topic: 'test',
          partition: 0,
          offset: 0
        }]);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to seek', function(cb) {
      consumer.seek({
        topic: 'test',
        partition: 0,
        offset: 0
      }, 1, function(err) {
        t.ifError(err);
        cb();
      });
    });

    it('should be able to seek with a timeout of 0', function(cb) {
      consumer.seek({
        topic: 'test',
        partition: 0,
        offset: 0
      }, 0, function(err) {
        t.ifError(err);
        cb();
      });
    });
  });

  describe('subscribe', function() {

    var topic = 'test';
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to subscribe', function() {
      t.equal(0, consumer.subscription().length);
      consumer.subscribe([topic]);
      t.equal(1, consumer.subscription().length);
      t.equal('test', consumer.subscription()[0]);
      t.equal(0, consumer.assignments().length);
    });

    it('should be able to unsubscribe', function() {
      consumer.subscribe([topic]);
      t.equal(1, consumer.subscription().length);
      consumer.unsubscribe();
      t.equal(0, consumer.subscription().length);
      t.equal(0, consumer.assignments().length);
    });
  });

  describe('assign', function() {

    var topic = 'test';
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to take an assignment', function() {
      t.equal(0, consumer.assignments().length);
      consumer.assign([{ topic:topic, partition:0 }]);
      t.equal(1, consumer.assignments().length);
      t.equal(topic, consumer.assignments()[0].topic);
      t.equal(0, consumer.subscription().length);
    });

    it('should be able to take an empty assignment', function() {
      consumer.assign([{ topic:topic, partition:0 }]);
      t.equal(1, consumer.assignments().length);
      consumer.assign([]);
      t.equal(0, consumer.assignments().length);
    });
  });

  describe('assignmentLost', function() {
    function pollForTopic(client, topicName, maxTries, tryDelay, cb, customCondition) {
      var tries = 0;

      function getTopicIfExists(innerCb) {
        client.getMetadata({
          topic: topicName,
        }, function(metadataErr, metadata) {
          if (metadataErr) {
            cb(metadataErr);
            return;
          }

          var topicFound = metadata.topics.filter(function(topicObj) {
            var foundTopic = topicObj.name === topicName;

            // If we have a custom condition for "foundedness", do it here after
            // we make sure we are operating on the correct topic
            if (foundTopic && customCondition) {
              return customCondition(topicObj);
            }
            return foundTopic;
          });

          if (topicFound.length >= 1) {
            innerCb(null, topicFound[0]);
            return;
          }

          innerCb(new Error('Could not find topic ' + topicName));
        });
      }

      function maybeFinish(err, obj) {
        if (err) {
          queueNextTry();
          return;
        }

        cb(null, obj);
      }

      function queueNextTry() {
        tries += 1;
        if (tries < maxTries) {
          setTimeout(function() {
            getTopicIfExists(maybeFinish);
          }, tryDelay);
        } else {
          cb(new Error('Exceeded max tries of ' + maxTries));
        }
      }

      queueNextTry();
    }

    var client = AdminClient.create({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList
    });
    var consumer1;
    var consumer2;
    var assignmentLostCount = 0;
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');
    var assignment_lost_gcfg = {
      'bootstrap.servers': kafkaBrokerList,
      'group.id': grp,
      'debug': 'all',
      'enable.auto.commit': false,
      'session.timeout.ms': 10000,
      'heartbeat.interval.ms': 1000,
      'auto.offset.reset': 'earliest',
      'topic.metadata.refresh.interval.ms': 3000,
      'partition.assignment.strategy': 'cooperative-sticky',
      'rebalance_cb': function(err, assignment) {
        if (
          err.code === LibrdKafkaError.codes.ERR__REVOKE_PARTITIONS &&
          this.assignmentLost()
        ) {
          assignmentLostCount++;
        }
        cooperativeRebalanceCallback.call(this, err, assignment);
      }
    };

    beforeEach(function(done) {
      assignment_lost_gcfg['client.id'] = 1;
      consumer1 = new KafkaConsumer(assignment_lost_gcfg, {});
      eventListener(consumer1);
      consumer1.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
      });
      assignment_lost_gcfg['client.id'] = 2;
      consumer2 = new KafkaConsumer(assignment_lost_gcfg, {});
      eventListener(consumer2);
      consumer2.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });
    });

    afterEach(function(done) {
      consumer1.disconnect(function() {
        consumer2.disconnect(function() {
          done();
        });
      });
    });

    it('should return false if not lost', function() {
      t.equal(false, consumer1.assignmentLost());
    });

    it('should be lost if topic gets deleted', function(cb) {
      this.timeout(100000);

      var time = Date.now();
      var topicName = 'consumer-assignment-lost-test-topic-' + time;
      var topicName2 = 'consumer-assignment-lost-test-topic2-' + time;
      var deleting = false;

      client.createTopic({
        topic: topicName,
        num_partitions: 2,
        replication_factor: 1
      }, function(err) {
        pollForTopic(consumer1, topicName, 10, 1000, function(err) {
          t.ifError(err);
          client.createTopic({
            topic: topicName2,
            num_partitions: 2,
            replication_factor: 1
          }, function(err) {
            pollForTopic(consumer1, topicName2, 10, 1000, function(err) {
              t.ifError(err);
              consumer1.subscribe([topicName, topicName2]);
              consumer2.subscribe([topicName, topicName2]);
              consumer1.consume();
              consumer2.consume();
              var tryDelete = function() {
                setTimeout(function() {
                  if(consumer1.assignments().length === 2 &&
                    consumer2.assignments().length === 2
                    ) {
                    client.deleteTopic(topicName, function(deleteErr) {
                      t.ifError(deleteErr);
                    });
                  } else {
                    tryDelete();
                  }
                }, 2000);
              };
              tryDelete();
            });
          });
        });
      });

      var checking = false;
      setInterval(function() {
        if (assignmentLostCount >= 2 && !checking) {
          checking = true;
          t.equal(assignmentLostCount, 2);
          client.deleteTopic(topicName2, function(deleteErr) {
            // Cleanup topics
            t.ifError(deleteErr);
            cb();
          });
        }
      }, 2000);
    });

  });

  describe('incrementalAssign and incrementUnassign', function() {

    var topic = 'test7';
    var consumer;
    beforeEach(function(done) {
      consumer = new KafkaConsumer(gcfg, {});

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        done();
      });

      eventListener(consumer);
    });

    afterEach(function(done) {
      consumer.disconnect(function() {
        done();
      });
    });

    it('should be able to assign an assignment', function() {
      t.equal(0, consumer.assignments().length);
      var assignments = [{ topic:topic, partition:0 }];
      consumer.assign(assignments);
      t.equal(1, consumer.assignments().length);
      t.equal(0, consumer.assignments()[0].partition);
      t.equal(0, consumer.subscription().length);

      var additionalAssignment = [{ topic:topic, partition:1 }];
      consumer.incrementalAssign(additionalAssignment);
      t.equal(2, consumer.assignments().length);
      t.equal(0, consumer.assignments()[0].partition);
      t.equal(1, consumer.assignments()[1].partition);
      t.equal(0, consumer.subscription().length);
    });

    it('should be able to revoke an assignment', function() {
      t.equal(0, consumer.assignments().length);
      var assignments = [{ topic:topic, partition:0 }, { topic:topic, partition:1 }, { topic:topic, partition:2 }];
      consumer.assign(assignments);
      t.equal(3, consumer.assignments().length);
      t.equal(0, consumer.assignments()[0].partition);
      t.equal(1, consumer.assignments()[1].partition);
      t.equal(2, consumer.assignments()[2].partition);
      t.equal(0, consumer.subscription().length);

      var revokedAssignments = [{ topic:topic, partition:2 }];
      consumer.incrementalUnassign(revokedAssignments);
      t.equal(2, consumer.assignments().length);
      t.equal(0, consumer.assignments()[0].partition);
      t.equal(1, consumer.assignments()[1].partition);
      t.equal(0, consumer.subscription().length);
    });

  });

  describe('rebalance', function() {

    var topic = 'test7';
    var grp = 'kafka-mocha-grp-' + crypto.randomBytes(20).toString('hex');
    var consumer1;
    var consumer2;
    var counter = 0;
    var reblance_gcfg = {
      'bootstrap.servers': kafkaBrokerList,
      'group.id': grp,
      'debug': 'all',
      'enable.auto.commit': false,
      'heartbeat.interval.ms': 200,
      'rebalance_cb': true
    };

    it('should be able reblance using the eager strategy', function(done) {
      this.timeout(20000);

      var isStarted = false;
      reblance_gcfg['partition.assignment.strategy'] = 'range,roundrobin';

      reblance_gcfg['client.id'] = '1';
      consumer1 = new KafkaConsumer(reblance_gcfg, {});
      reblance_gcfg['client.id'] = '2';
      consumer2 = new KafkaConsumer(reblance_gcfg, {});

      eventListener(consumer1);
      eventListener(consumer2);

      consumer1.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        consumer1.subscribe([topic]);
        consumer1.on('rebalance', function(err, assignment) {
          counter++;
          if (!isStarted) {
            isStarted = true;
            consumer2.connect({ timeout: 2000 }, function(err, info) {
              consumer2.subscribe([topic]);
              consumer2.consume();
              consumer2.on('rebalance', function(err, assignment) {
                counter++;
              });
            });
          }
        });
        consumer1.consume();
      });

      setTimeout(function() {
        t.deepStrictEqual(consumer1.assignments(), [ { topic: topic, partition: 0, offset: -1000 } ]);
        t.deepStrictEqual(consumer2.assignments(), [ { topic: topic, partition: 1, offset: -1000 } ]);
        t.equal(counter, 4);
        consumer1.disconnect(function() {
          consumer2.disconnect(function() {
            done();
          });
        });
      }, 9000);
    });

    it('should be able reblance using the cooperative incremental strategy', function(cb) {
      this.timeout(20000);
      var isStarted = false;
      reblance_gcfg['partition.assignment.strategy'] = 'cooperative-sticky';
      reblance_gcfg['client.id'] = '1';
      consumer1 = new KafkaConsumer(reblance_gcfg, {});
      reblance_gcfg['client.id'] = '2';
      consumer2 = new KafkaConsumer(reblance_gcfg, {});

      eventListener(consumer1);
      eventListener(consumer2);

      consumer1.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);
        consumer1.subscribe([topic]);
        consumer1.on('rebalance', function(err, assignment) {
          if (!isStarted) {
            isStarted = true;
            consumer2.connect({ timeout: 2000 }, function(err, info) {
              consumer2.subscribe([topic]);
              consumer2.consume();
              consumer2.on('rebalance', function(err, assignment) {
                counter++;
              });
            });
          }
        });
        consumer1.consume();
      });

      setTimeout(function() {
        t.equal(consumer1.assignments().length, 1);
        t.equal(consumer2.assignments().length, 1);
        t.equal(counter, 8);

        consumer1.disconnect(function() {
          consumer2.disconnect(function() {
            cb();
          });
        });
      }, 9000);
    });

  });

  describe('disconnect', function() {

    var topic = 'test';
    var tcfg = { 'auto.offset.reset': 'earliest' };

    it('should happen gracefully', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.disconnect(function() {
          cb();
        });

      });

    });

    it('should happen without issue after subscribing', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe([topic]);

        consumer.disconnect(function() {
          cb();
        });

      });

    });

    it('should happen without issue after consuming', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);
      consumer.setDefaultConsumeTimeout(10000);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe([topic]);

        consumer.consume(1, function(err, messages) {
          t.ifError(err);

          consumer.disconnect(function() {
            cb();
          });
        });

      });

    });

    it('should happen without issue after consuming an error', function(cb) {
      var consumer = new KafkaConsumer(gcfg, tcfg);

      consumer.setDefaultConsumeTimeout(1);

      consumer.connect({ timeout: 2000 }, function(err, info) {
        t.ifError(err);

        consumer.subscribe([topic]);

        consumer.consume(1, function(err, messages) {

          // Timeouts do not classify as errors anymore
          t.equal(messages[0], undefined, 'Message should not be set');

          consumer.disconnect(function() {
            cb();
          });
        });

      });
    });

  });
});
