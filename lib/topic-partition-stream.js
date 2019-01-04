module.exports = TopicPartitionStream;

var Transform = require('stream').Transform;
var util = require('util');

util.inherits(TopicPartitionStream, Transform);

function TopicPartitionStream(toppar, options={}) {
  if (!(this instanceof TopicPartitionStream)) {
    return new TopicPartitionStream(toppar, options);
  } 

  Transform.call(this, { 
    ...options, 
    objectMode: true, 
    readableHighWaterMark: 8,
    writableHighWaterMark: 8
  });

  this.topic = toppar.topic;
  this.partition = toppar.partition;
}


TopicPartitionStream.prototype._transform = function(message, encoding, callback) {
  callback(null, message);
}
