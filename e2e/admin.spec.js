/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');
var t = require('assert');

var eventListener = require('./listener');
var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';
var time = Date.now();

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

describe('Admin', function() {
  var client;
  var producer;

  before(function(done) {
    producer = new Kafka.Producer({
      'metadata.broker.list': kafkaBrokerList,
    });
    producer.connect(null, function(err) {
      t.ifError(err);
      done();
    });
  });

  after(function(done) {
    producer.disconnect(function() {
      done();
    });
  });

  beforeEach(function() {
    this.timeout(10000);
    client = Kafka.AdminClient.create({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList
    });
  });

  describe('createTopic', function() {
    it('should create topic sucessfully', function(done) {
      var topicName = 'admin-test-topic-' + time;
      this.timeout(30000);
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function(err) {
        pollForTopic(producer, topicName, 10, 1000, function(err) {
          t.ifError(err);
          done();
        });
      });
    });

    it('should raise an error when replication_factor is larger than number of brokers', function(done) {
      var topicName = 'admin-test-topic-bad-' + time;
      this.timeout(30000);
      client.createTopic({
        topic: topicName,
        num_partitions: 9999,
        replication_factor: 9999
      }, function(err) {
        t.equal(typeof err, 'object', 'an error should be returned');
        done();
      });
    });
  });

  describe('deleteTopic', function() {
    it('should be able to delete a topic after creation', function(done) {
      var topicName = 'admin-test-topic-2bdeleted-' + time;
      this.timeout(30000);
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function(err) {
        pollForTopic(producer, topicName, 10, 1000, function(err) {
          t.ifError(err);
          client.deleteTopic(topicName, function(deleteErr) {
            // Fail if we got an error
            t.ifError(deleteErr);
            done();
          });
        });
      });
    });
  });

  describe('createPartitions', function() {
    it('should be able to add partitions to a topic after creation', function(done) {
      var topicName = 'admin-test-topic-newparts-' + time;
      this.timeout(30000);
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function(err) {
        pollForTopic(producer, topicName, 10, 1000, function(err) {
          t.ifError(err);
          client.createPartitions(topicName, 20, function(createErr) {
            pollForTopic(producer, topicName, 10, 1000, function(pollErr) {
              t.ifError(pollErr);
              done();
            }, function(topic) {
              return topic.partitions.length === 20;
            });
          });
        });
      });
    });

    it('should NOT be able to reduce partitions to a topic after creation', function(done) {
      var topicName = 'admin-test-topic-newparts2-' + time;
      this.timeout(30000);
      client.createTopic({
        topic: topicName,
        num_partitions: 4,
        replication_factor: 1
      }, function(err) {
        pollForTopic(producer, topicName, 10, 1000, function(err) {
          t.ifError(err);
          client.createPartitions(topicName, 1, function(createErr) {
            t.equal(typeof createErr, 'object', 'an error should be returned');
            done();
          });
        });
      });
    });
  });

});
