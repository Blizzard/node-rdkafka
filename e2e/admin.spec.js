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

describe('Admin', function() {

  var client;

  beforeEach(function() {
      client = Kafka.AdminClient.create({
        'client.id': 'kafka-test',
        'metadata.broker.list': kafkaBrokerList
      });
  });


  it('should create topic sucessfully', function(done) {
    this.timeout(30000);
    client.createTopic({
        topic: 'admin-test-topic',
        num_partitions: 1,
        replication_factor: 1
    }, function(err) {
      t.ifError(err);
      done();
    });
  });

  it('should raise an error when partitions are larger than number of brokers', function(done) {
    this.timeout(30000);
    client.createTopic({
        topic: 'admin-test-topic',
        num_partitions: 99999999999,
        replication_factor: 99999999999
    }, function(err) {
      t.equal(typeof err, 'object', 'an error should be returned');
      done();
    });
  });

});
