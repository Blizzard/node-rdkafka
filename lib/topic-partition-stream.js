module.exports = TopicPartitionStream;

var Readable = require('stream').Readable;
var util = require('util');

util.inherits(TopicPartitionStream, Readable);

function TopicPartitionStream(toppar, options) {
  if (!(this instanceof TopicPartitionStream)) {
    return new TopicPartitionStream(toppar, options);
  }

  Readable.call(this, { ...options, objectMode: true });
}