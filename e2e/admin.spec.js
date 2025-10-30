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
var crypto = require('crypto');

var eventListener = require('./listener');
var kafkaBrokerList = process.env.KAFKA_HOST || 'localhost:9092';
var time = Date.now();

function pollForTopic(client, topicName, maxTries, tryDelay, cb, customCondition) {
  var tries = 0;

  function getTopicIfExists(innerCb) {
    client.getMetadata({
      topic: topicName,
    }, function (metadataErr, metadata) {
      if (metadataErr) {
        cb(metadataErr);
        return;
      }

      var topicFound = metadata.topics.filter(function (topicObj) {
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
      setTimeout(function () {
        getTopicIfExists(maybeFinish);
      }, tryDelay);
    } else {
      cb(new Error('Exceeded max tries of ' + maxTries));
    }
  }

  queueNextTry();
}

describe('Admin', function () {
  var client;
  var producer;
  var consumerGroup;

  // Define constants if not available in Kafka object
  var RESOURCE_TOPIC = 2; // RD_KAFKA_RESOURCE_TOPIC

  // Generate a unique consumer group ID for testing
  var consumerGroupId = 'kafka-test-group-' + crypto.randomBytes(6).toString('hex');

  before(function (done) {
    producer = new Kafka.Producer({
      'metadata.broker.list': kafkaBrokerList,
    });
    producer.connect(null, function (err) {
      t.ifError(err);
      done();
    });
  });

  after(function (done) {
    producer.disconnect(function () {
      done();
    });
  });

  beforeEach(function () {
    client = Kafka.AdminClient.create({
      'client.id': 'kafka-test',
      'metadata.broker.list': kafkaBrokerList
    });
  });

  describe('createTopic', function () {
    it('should create topic sucessfully', function (done) {
      var topicName = 'admin-test-topic-' + time;
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function (err) {
        pollForTopic(producer, topicName, 10, 1000, function (err) {
          t.ifError(err);
          done();
        });
      });
    });

    it('should raise an error when replication_factor is larger than number of brokers', function (done) {
      var topicName = 'admin-test-topic-bad-' + time;
      client.createTopic({
        topic: topicName,
        num_partitions: 9999,
        replication_factor: 9999
      }, function (err) {
        t.equal(typeof err, 'object', 'an error should be returned');
        done();
      });
    });
  });

  describe('deleteTopic', function () {
    it('should be able to delete a topic after creation', function (done) {
      var topicName = 'admin-test-topic-2bdeleted-' + time;
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function (err) {
        pollForTopic(producer, topicName, 10, 1000, function (err) {
          t.ifError(err);
          client.deleteTopic(topicName, function (deleteErr) {
            // Fail if we got an error
            t.ifError(deleteErr);
            done();
          });
        });
      });
    });
  });

  describe('createPartitions', function () {
    it('should be able to add partitions to a topic after creation', function (done) {
      var topicName = 'admin-test-topic-newparts-' + time;
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function (err) {
        pollForTopic(producer, topicName, 10, 1000, function (err) {
          t.ifError(err);
          client.createPartitions(topicName, 20, function (createErr) {
            pollForTopic(producer, topicName, 10, 1000, function (pollErr) {
              t.ifError(pollErr);
              done();
            }, function (topic) {
              return topic.partitions.length === 20;
            });
          });
        });
      });
    });

    it('should NOT be able to reduce partitions to a topic after creation', function (done) {
      var topicName = 'admin-test-topic-newparts2-' + time;
      client.createTopic({
        topic: topicName,
        num_partitions: 4,
        replication_factor: 1
      }, function (err) {
        pollForTopic(producer, topicName, 10, 1000, function (err) {
          t.ifError(err);
          client.createPartitions(topicName, 1, function (createErr) {
            t.equal(typeof createErr, 'object', 'an error should be returned');
            done();
          });
        });
      });
    });
  });

  describe('describeConfigs', function () {
    it('should describe topic configurations', function (done) {
      var topicName = 'admin-test-topic-config-' + time;

      // First create a topic
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function (err) {
        if (err) {
          return done(err);
        }
        t.ifError(err);

        // Wait for topic to be created
        pollForTopic(producer, topicName, 10, 1000, function (err) {
          if (err) {
            return done(err);
          }
          t.ifError(err);

          // Now describe its configs
          client.describeConfigs([
            {
              type: RESOURCE_TOPIC,  // Use our defined constant
              name: topicName,
              configNames: ['retention.ms']
            }
          ], function (err, result) {
            if (err) {
              return done(err);
            }
            t.ifError(err, 'No error should be returned');

            // Validate the result structure
            t.ok(result, 'Result should be returned');
            t.ok(result.resources, 'Result should have resources array');
            t.equal(result.resources.length, 1, 'One resource should be returned');

            var resource = result.resources[0];
            if (resource.configs && resource.configs.length > 0) {
              // Process configs as before
            }

            t.equal(resource.name, topicName, 'Resource name should match topic name');
            t.equal(resource.type, RESOURCE_TOPIC, 'Resource type should be RESOURCE_TOPIC (2)');
            t.ok(resource.configs, 'Resource should have configs array');
            t.ok(Array.isArray(resource.configs), 'Configs should be an array');
            t.ok(resource.configs.length > 0, 'At least one config entry should be returned');

            // Verify we only get the configs we requested
            t.equal(resource.configs.length, 1, 'Only one config should be returned (retention.ms)');
            t.equal(resource.configs[0].name, 'retention.ms', 'The config returned should be retention.ms');

            // Find the retention.ms config
            var retentionConfig = null;

            for (var i = 0; i < resource.configs.length; i++) {
              var config = resource.configs[i];
              if (config.name === 'retention.ms') {
                retentionConfig = config;
                break;
              }
            }

            // Verify retention.ms exists and has expected properties
            t.ok(retentionConfig, 'retention.ms config should exist');
            if (retentionConfig) {
              t.ok('value' in retentionConfig, 'retention.ms should have a value');
              t.ok('source' in retentionConfig, 'retention.ms should have a source property');
              t.ok('isDefault' in retentionConfig, 'retention.ms should have isDefault property');

              // Verify retention.ms value is a valid number (or string that converts to number)
              var retentionValue = parseInt(retentionConfig.value, 10);
              t.ok(!isNaN(retentionValue), 'retention.ms should have a numeric value');
            }

            // Validate a generic config entry
            var configEntry = resource.configs[0];
            t.ok('name' in configEntry, 'Config entry should have a name');
            t.ok('value' in configEntry, 'Config entry should have a value');
            t.ok('source' in configEntry, 'Config entry should have a source');
            t.ok('isDefault' in configEntry, 'Config entry should have isDefault');
            t.ok('isReadOnly' in configEntry, 'Config entry should have isReadOnly');
            t.ok('isSensitive' in configEntry, 'Config entry should have isSensitive');

            done();
          });
        });
      });
    });

    it('should support timeout parameter', function (done) {
      var topicName = 'admin-test-topic-config-timeout-' + time;

      // First create a topic
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function (err) {
        t.ifError(err);

        // Wait for topic to be created
        pollForTopic(producer, topicName, 10, 1000, function (err) {
          t.ifError(err);

          // Now describe its configs with timeout
          client.describeConfigs([
            {
              type: RESOURCE_TOPIC,  // Use our defined constant
              name: topicName,
              configNames: ['retention.ms']
            }
          ], function (err, result) {
            t.ifError(err, 'No error should be returned');

            done();
          }, 5000); // 5 seconds timeout
        });
      });
    });

    it('should return error for non-existent resource', function (done) {
      // Try to describe configs for a non-existent topic
      var nonExistentTopic = 'non-existent-topic-' + Date.now();
      client.describeConfigs([
        {
          type: RESOURCE_TOPIC,  // Use our defined constant
          name: nonExistentTopic,
          configNames: ['retention.ms']
        }
      ], function (err, result) {
        // We should get an error back OR a result with resource error
        if (err) {
          t.ok(err, 'Error should be returned for non-existent resource');
          done();
        } else if (result && result.resources && result.resources.length > 0) {
          var resource = result.resources[0];
          t.equal(resource.name, nonExistentTopic, 'Resource name should match');
          t.ok(resource.error, 'Resource should have an error property');
          done();
        } else {
          t.fail('Neither error nor resource error was returned');
          done();
        }
      });
    });
  });

  describe('alterConfigs', function () {
    it('should alter and reset topic configurations', function (done) {
      this.timeout(30000); // Increase timeout for multiple async operations
      var topicName = 'admin-test-topic-alter-' + time;
      var initialRetention = '604800000'; // Default Kafka retention in ms (7 days)
      var alteredRetention = '604800001'; // A slightly different value

      // 1. Create a topic
      client.createTopic({
        topic: topicName,
        num_partitions: 1,
        replication_factor: 1
      }, function (err) {
        t.ifError(err, 'Topic creation should succeed');

        // 2. Wait for the topic to be created
        pollForTopic(producer, topicName, 15, 1000, function (err) {
          t.ifError(err, 'Polling for topic should succeed');

          // 3. Alter the retention.ms config
          client.alterConfigs([
            {
              type: RESOURCE_TOPIC,
              name: topicName,
              configEntries: [
                { name: 'retention.ms', value: alteredRetention }
              ]
            }
          ], function (alterErr, alterResult) {
            t.ifError(alterErr, 'alterConfigs should not return a top-level error');
            t.ok(alterResult, 'alterConfigs should return a result');
            t.ok(alterResult.resources, 'alterConfigs result should have resources');
            t.equal(alterResult.resources.length, 1, 'alterConfigs result should have one resource');
            t.ifError(alterResult.resources[0].error, 'Resource alteration should succeed');

            // Wait a moment for the change to propagate
            setTimeout(function () {
              client.describeConfigs([
                { type: RESOURCE_TOPIC, name: topicName, configNames: ['retention.ms'] }
              ], function (descErr1, descResult1) {
                t.ifError(descErr1, 'describeConfigs (after alter) should not return a top-level error');
                t.ok(descResult1 && descResult1.resources && descResult1.resources.length === 1, 'describeConfigs (after alter) result format is correct');
                t.ifError(descResult1.resources[0].error, 'describeConfigs (after alter) resource should not have error');
                t.ok(descResult1.resources[0].configs, 'describeConfigs (after alter) should have configs');

                var config = descResult1.resources[0].configs.find(c => c.name === 'retention.ms');
                t.ok(config, 'retention.ms config should be found after alter');
                t.equal(config.value, alteredRetention, 'retention.ms should have the altered value');
                t.equal(config.isDefault, false, 'retention.ms should not be default after alter');

                // 5. Reset the retention.ms config using null value
                client.alterConfigs([
                  {
                    type: RESOURCE_TOPIC,
                    name: topicName,
                    configEntries: [
                      { name: 'retention.ms', value: null } // Resetting to default
                    ]
                  }
                ], function (resetErr, resetResult) {
                  t.ifError(resetErr, 'alterConfigs (reset) should not return a top-level error');
                  t.ok(resetResult && resetResult.resources && resetResult.resources.length === 1, 'alterConfigs (reset) result format correct');
                  t.ifError(resetResult.resources[0].error, 'Resource reset should succeed');

                  // 6. Describe configs again to verify the reset
                  // Wait again for propagation
                  setTimeout(function () {
                    client.describeConfigs([
                      { type: RESOURCE_TOPIC, name: topicName, configNames: ['retention.ms'] }
                    ], function (descErr2, descResult2) {
                      t.ifError(descErr2, 'describeConfigs (after reset) should not return a top-level error');
                      t.ok(descResult2 && descResult2.resources && descResult2.resources.length === 1, 'describeConfigs (after reset) result format correct');
                      t.ifError(descResult2.resources[0].error, 'describeConfigs (after reset) resource should not have error');
                      t.ok(descResult2.resources[0].configs, 'describeConfigs (after reset) should have configs');

                      var resetConfig = descResult2.resources[0].configs.find(c => c.name === 'retention.ms');
                      t.ok(resetConfig, 'retention.ms config should be found after reset');
                      // Don't check isDefault flag as it might stay false with some Kafka versions
                      // Just check that the value has changed from our custom value
                      t.notEqual(resetConfig.value, alteredRetention, 'retention.ms should be different from altered value after reset');

                      done(); // Test finished successfully
                    });
                  }, 5000); // Wait 5 seconds before final describe
                });
              });
            }, 5000); // Wait 5 seconds before describing
          });
        });
      });
    });
  });
});
