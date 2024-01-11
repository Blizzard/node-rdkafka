A consumer that is subscribed to multiple partitions can control the mix of messages consumed from each partition. How this is done is explained [here](https://github.com/confluentinc/librdkafka/wiki/FAQ#what-are-partition-queues-and-why-are-some-partitions-slower-than-others).

The example below simulates a partition 0 which is slow (2s per consume). Other partitions consume at a rate of 0.5s. To use the example, create a topic "test" with two partitions. Produce 500 message to both partitions. This example does not require an active producer. Run the example to see the result. Run multiple instances to see the rebalancing take effect.

```js
/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');

var consumer = new Kafka.KafkaConsumer({
  //'debug': 'all',
  'metadata.broker.list': 'localhost:9092',
  'group.id': 'node-rdkafka-consumer-per-partition-example',
  'enable.auto.commit': false,
  'rebalance_cb': true,
}, {
  'auto.offset.reset': 'earliest', // start from the beginning
});

var topicName = 'test';

// Keep track of which partitions are assigned.
var assignments = [];

//logging debug messages, if debug is enabled
consumer.on('event.log', function(log) {
  console.log(log);
});

//logging all errors
consumer.on('event.error', function(err) {
  console.error('Error from consumer');
  console.error(err);
});

consumer.on('ready', function(arg) {
  console.log('consumer ready: ' + JSON.stringify(arg));

  consumer.subscribe([topicName]);

  // Remove the default timeout so that we won't wait on each consume
  consumer.setDefaultConsumeTimeout(0);

  // start a regular consume loop in flowing mode. This won't result in any
  // messages because will we start consuming from a partition directly.
  // This is required to serve the rebalancing events
  consumer.consume();
});

// Start our own consume loops for all newly assigned partitions
consumer.on('rebalance', function(err, updatedAssignments) {
  console.log('rebalancing done, got partitions assigned: ', updatedAssignments.map(function(a) {
    return a.partition;
  }));

  // find new assignments
  var newAssignments = updatedAssignments.filter(function (updatedAssignment) {
    return !assignments.some(function (assignment) {
      return assignment.partition === updatedAssignment.partition;
    });
  });

  // update global assignments array
  assignments = updatedAssignments;

  // then start consume loops for the new assignments
  newAssignments.forEach(function (assignment) {
    startConsumeMessages(assignment.partition);
  });
});

function startConsumeMessages(partition) {
  console.log('partition: ' + partition + ' starting to consume');

  function consume() {
    var isPartitionAssigned = assignments.some(function(assignment) {
      return assignment.partition === partition;
    });

    if (!isPartitionAssigned) {
      console.log('partition: ' + partition + ' stop consuming');
      return;
    }

    // consume per 5 messages
    consumer.consume(5, topicName, partition, callback);
  }

  function callback(err, messages) {
    messages.forEach(function(message) {
      // consume the message
      console.log('partition ' + message.partition + ' value ' + message.value.toString());
      consumer.commitMessage(message);
    });

    if (messages.length > 0) {
      consumer.commitMessage(messages.pop());
    }

    // simulate performance
    setTimeout(consume, partition === 0 ? 2000 : 500);
  }

  // kick-off recursive consume loop
  consume();
}

consumer.on('disconnected', function(arg) {
  console.log('consumer disconnected. ' + JSON.stringify(arg));
});

//starting the consumer
consumer.connect();

//stopping this example after 30s
setTimeout(function() {
  consumer.disconnect();
}, 30000);

```
