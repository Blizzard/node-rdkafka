module.exports = TopicPartitionStream;

var Transform = require('stream').Transform;
var util = require('util');

util.inherits(TopicPartitionStream, Transform);

function TopicPartitionStream(toppar, buffer, options={}) {
  if (!(this instanceof TopicPartitionStream)) {
    return new TopicPartitionStream(toppar, options);
  } 

  Transform.call(this, { ...options, objectMode: true });

  this.topic = toppar.topic;
  this.partition = toppar.partition;
}


TopicPartitionStream.prototype._transform = function(message, encoding, callback) {
  callback(null, message);
}
