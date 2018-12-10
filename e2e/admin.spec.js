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

function pollForTopic(client, topicName, maxTries, tryDelay, cb) {
  var tries = 0;

  function getTopicIfExists(innerCb) {
    client.getMetadata({}, function(metadataErr, metadata) {
      if (metadataErr) {
        cb(metadataErr);
        return;
      }

      var topicFound = metadata.topics.filter(function(topicObj) {
        return topicObj.name === topicName;
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
