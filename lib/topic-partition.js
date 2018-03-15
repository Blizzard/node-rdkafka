/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Topic = require('./topic');

module.exports = TopicPartition;

/**
 * Map an array of topic partition js objects to real topic partition objects.
 *
 * @param array The array of topic partition raw objects to map to topic
 *              partition objects
 */
TopicPartition.map = function(array) {
  return array.map(function(element) {
    return TopicPartition.create(element);
  });
};

/**
 * Take a topic partition javascript object and convert it to the class.
 * The class will automatically convert offset identifiers to special constants
 *
 * @param element The topic partition raw javascript object
 */
TopicPartition.create = function(element) {
  // Just ensure we take something that can have properties. The topic partition
  // class will
  element = element || {};
  return new TopicPartition(element.topic, element.partition, element.offset);
};

/**
 * Create a topic partition. Just does some validation and decoration
 * on topic partitions provided.
 *
 * Goal is still to behave like a plain javascript object but with validation
 * and potentially some extra methods
 */
function TopicPartition(topic, partition, offset) {
  if (!(this instanceof TopicPartition)) {
    return new TopicPartition(topic, partition, offset);
  }

  // Validate that the elements we are iterating over are actual topic partition
  // js objects. They do not need an offset, but they do need partition
  if (!topic) {
    throw new TypeError('"topic" must be a string and must be set');
  }

  if (partition === null || partition === undefined) {
    throw new TypeError('"partition" must be a number and must set');
  }

  // We can just set topic and partition as they stand.
  this.topic = topic;
  this.partition = partition;

  if (offset === undefined || offset === null) {
    this.offset = Topic.OFFSET_STORED;
  } else if (typeof offset === 'string') {
    switch (offset.toLowerCase()) {
      case 'earliest':
      case 'beginning':
        this.offset = Topic.OFFSET_BEGINNING;
        break;
      case 'latest':
      case 'end':
        this.offset = Topic.OFFSET_END;
        break;
      case 'stored':
        this.offset = Topic.OFFSET_STORED;
        break;
      default:
        throw new TypeError('"offset", if provided as a string, must be beginning, end, or stored.');
    }
  } else if (typeof offset === 'number') {
    this.offset = offset;
  } else {
    throw new TypeError('"offset" must be a special string or number if it is set');
  }
}
