/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var KafkaConsumer = require('../lib/kafka-consumer');
var Transform = require('stream').Transform;
var t = require('assert');
var Sinon = require('sinon');
var H = require('highland');

var client;
var defaultConfig = {
  'client.id': 'kafka-mocha',
  'group.id': 'kafka-mocha-grp',
  'metadata.broker.list': 'localhost:9092'
};
var topicConfig = {};

const generateTestMessage = (message = {}) => ({
  topic: 'test',
  partition: 0,
  key: 'testKey',
  offset: 1,
  ...message,
  value: Buffer.isBuffer(message.value) ? message.value : Buffer.from(message.value || 'test')
});

const repeat = (value, size) => [...Array(size).keys()].map(() => value);

module.exports = {
  'KafkaConsumer client': {
    'beforeEach': function() {
      client = new KafkaConsumer(defaultConfig, topicConfig);
    },
    'afterEach': function() {
      client = null;
    },
    'does not modify config and clones it': function () {
      t.deepStrictEqual(defaultConfig, {
        'client.id': 'kafka-mocha',
        'group.id': 'kafka-mocha-grp',
        'metadata.broker.list': 'localhost:9092'
      });
      t.deepStrictEqual(client.globalConfig, {
        'client.id': 'kafka-mocha',
        'group.id': 'kafka-mocha-grp',
        'metadata.broker.list': 'localhost:9092'
      });
      t.notEqual(defaultConfig, client.globalConfig);
    },
    'does not modify topic config and clones it': function () {
      t.deepStrictEqual(topicConfig, {});
      t.deepStrictEqual(client.topicConfig, {});
      t.notEqual(topicConfig, client.topicConfig);
    },

    'stream()': {
      'beforeEach': function() {
        const pausedToppars = new Set();
        Sinon.stub(client, 'isConnected').returns(true);
        client.__exampleMessages = [];
        Sinon.stub(client, '_consumeNum').callsFake((timeout, size, cb) => {
          t.ok(typeof timeout === 'number' && size >= 0, 'consumer._consumeNum must be called with a timeout');
          t.ok(typeof size === 'number' && size > 0, 'consumer._consumeNum must be called with a size');
          t.equal(typeof cb, 'function', 'consumer._consumeNum must be called with a callback function');
          
          setImmediate(function() {
            const isResumed = ({ topic, partition }) => !pausedToppars.has(`${topic}::${partition}`)
            const messages = client.__exampleMessages.filter(isResumed).slice(0, size);
            client.__exampleMessages = client.__exampleMessages
              .filter((message) => !messages.includes(message))

            cb(null, messages);
          })
        });
        Sinon.stub(client, 'disconnect').callsFake((cb) => {
          client.isConnected.returns(false);
          client._isConnecting = false;
          client._isConnected = false;
          client.emit('disconnected');
          if (cb) {
            t.equal(typeof cb, 'function');
            setImmediate(cb);
          }
        });
        Sinon.stub(client, 'connect').callsFake((options, cb) => {
          client.isConnected.returns(false);
          client._isConnecting = true;
          client._isConnected = false;
          
          setTimeout(() => {
            client.isConnected.returns(true);
            client._isConnecting = false;
            client._isConnected = true;
            client.emit('ready', { name: 'stubbedBroker' });
            if (cb) {
              t.equal(typeof cb, 'function');
              setImmediate(cb);
            }
          }, 5);
        });
        Sinon.stub(client, 'pause').callsFake((toppars) => {
          if (!client.isConnected()) {
            throw new Error ('Client is disconnected');
          }

          toppars.forEach(({ topic, partition}) => {
            pausedToppars.add(`${topic}::${partition}`);
          })
        }),
        Sinon.stub(client, 'resume').callsFake((toppars) => {
          if (!client.isConnected()) {
            throw new Error ('Client is disconnected');
          }

          toppars.forEach(({ topic, partition }) => {
            pausedToppars.delete(`${topic}::${partition}`);
          })
        })
      },
      'afterEach': function(done) {
        client.isConnected.returns(false);
        client._isConnecting = false;
        client._isConnected = false;
        client.once('finished', done);
        client.disconnect();
      },
      'can return a toppar stream': function() {
        const stream1 = client.stream({ topic: 'test', partition: 0 });
        const stream2 = client.stream({ topic: 'test', partition: 1 });
        const stream3 = client.stream({ topic: 'test', partition: 0 });
        const stream4 = client.stream({ topic: 'test', partition: 2 }, { highWaterMark: 3 })
        
        t.ok(stream1 instanceof Transform);
        t.equal(stream1.topic, 'test', 'toppar stream has a topic attribute');
        t.equal(stream1.partition, 0, 'toppar stream has a partition attribute');
        t.notEqual(stream1, stream2, 'returns a separate stream for each different toppar');
        t.equal(stream1, stream3, 'returns the same toppar stream for the same toppar');
        t.equal(stream4._readableState.highWaterMark, 3, 'forward stream options to the toppar stream');

        stream1.destroy();
        stream2.destroy();
        stream4.destroy();
      },


      'will wait with consuming messages until connected': function(done) {
        client.disconnect();

        const stream1 = client.stream({ topic: 'test', partition: 0 });
        const stream2 = client.stream({ topic: 'test', partition: 1 });

        t.ok(!client._consumeNum.called, 'does not attempt to consume messages while disconnected');        

        client.connect({}, () => {
          t.ok(client._consumeNum.calledOnce, 'resumes consuming messages for stream upon client connecting');

          stream1.destroy();
          stream2.destroy();
          done()
        })
      },

      'feeds streams with messages of matching toppar continuously': async function() {
        const testMessages = [
          generateTestMessage({ topic: 'test', partition: 0 }),
          generateTestMessage({ topic: 'test', partition: 1 }),
          generateTestMessage({ topic: 'test', partition: 1 }),
          generateTestMessage({ topic: 'test', partition: 0 })
        ];
        const stream1 = client.stream({ topic: 'test', partition: 0 });
        const stream2 = client.stream({ topic: 'test', partition: 1 });

        const streaming = [stream1, stream2].map((stream) => {
          const verify = (message) => {
            t.equal(typeof message, 'object');
            t.equal(message.topic, stream.topic);
            t.equal(message.partition, stream.partition);
          }
          return H(stream).take(2).tap(verify).collect().toPromise(Promise);
        });

        client.__exampleMessages = testMessages;

        await streaming;
      },

      "each stream has it's own individual back-pressure and can consume in parallel": async function() {
        const fastStream = client.stream({ topic: 'fast', partition: 0 });
        const slowStream = client.stream({ topic: 'slow', partition: 0 });

        const testMessages = [
          { topic: 'slow' },
          { topic: 'slow' },
          { topic: 'slow' },
          { topic: 'slow' },
          { topic: 'fast' },
          { topic: 'fast' }
        ].map(generateTestMessage)

        client.__exampleMessages = testMessages

        const consumedMessages = await H([
            { stream: slowStream, timeout: 200 },
            { stream: fastStream, timeout: 1 }
          ])
          .map(({ stream, timeout }) => {
            return H(stream).ratelimit(1, timeout)
          })
          .merge()
          .take(testMessages.length)
          .collect()
          .toPromise(Promise);

        const consumedTopics = consumedMessages.map((m) => m.topic);

        t.deepEqual(consumedTopics, ['slow', 'fast', 'fast', 'slow', 'slow', 'slow']);
      },

      "pauses toppar for streams that fill up their internal buffer": async function() {
        const fastStream = client.stream({ topic: 'fast', partition: 0 });
        const slowStream = client.stream({ topic: 'slow', partition: 0 });

        const testMessages = [
          ...repeat({ topic: 'slow' }, 24),
          ...repeat({ topic: 'fast' }, 24)
        ].map(generateTestMessage);

        client.__exampleMessages = testMessages;

        const consumedMessages = await H([
            { stream: slowStream, timeout: 20 },
            { stream: fastStream, timeout: 1 }
          ])
          .map(({ stream, timeout }) => {
            return H(stream).ratelimit(1, timeout)
          })
          .merge()
          .take(testMessages.length)
          .collect()
          .toPromise(Promise);

        t.ok(client.pause.calledWith(Sinon.match.every(Sinon.match.has('topic', 'slow'))));
        t.ok(client.resume.calledWith(Sinon.match.every(Sinon.match.has('topic', 'slow'))));
      },

      "feeds messages to streams at reduced rate as their buffers fill up": async function () {
        const maxFetchSize = client._maxFetchSize;
        // configure streams to buffer few enough messages, so a single fetch size is too big
        const streams = [
          client.stream({ topic: 'slow', partition: 0 }, { highWaterMark: Math.ceil(maxFetchSize / 2) }),
          client.stream({ topic: 'slow', partition: 1 }, { highWaterMark: Math.ceil(maxFetchSize / 2) }),
        ]


        // generate exactly enough messages that 2 max fetches consumes them
        const testMessages = [
          ...repeat({ topic: 'slow', partition: 0 }, maxFetchSize),
          ...repeat({ topic: 'slow', partition: 1 }, maxFetchSize)
        ].map(generateTestMessage);

        client.__exampleMessages = testMessages;

        const consumedMessages = await H(streams)
          .map((stream) => {
            // slow down consumption to make sure we're in a state of buffered messages
            return H(stream).ratelimit(1, 10)
          })
          .merge()
          .take(testMessages.length)
          .collect()
          .toPromise(Promise);

        const fetchSizes = client._consumeNum.getCalls().map((call) => call.args[1])
        t.ok(fetchSizes.every((size) => size < maxFetchSize))
      },

      "does not throttle reading of streams when there is space left in buffers": async function () {
        const maxFetchSize = client._maxFetchSize;
        // configure streams with buffers big enough to fit all the test messages
        const streams = [
          client.stream({ topic: 'fast', partition: 0 }, { highWaterMark: Math.ceil(maxFetchSize * 4) }),
          client.stream({ topic: 'fast', partition: 1 }, { highWaterMark: Math.ceil(maxFetchSize * 4) }),
        ]


        // generate exactly enough messages that 2 max fetches consumes them
        const testMessages = [
          ...repeat({ topic: 'fast', partition: 0 }, maxFetchSize),
          ...repeat({ topic: 'fast', partition: 1 }, maxFetchSize)
        ].map(generateTestMessage);

        client.__exampleMessages = testMessages;

        const consumedMessages = await H(streams)
          .map((stream) => {
            // slow down consumption to make sure we hvae to
            return H(stream).ratelimit(1, 10)
          })
          .merge()
          .take(testMessages.length)
          .collect()
          .toPromise(Promise);

        const fetchSizes = client._consumeNum.getCalls().map((call) => call.args[1])
        t.ok(fetchSizes.every((size) => size === maxFetchSize))
      }
    }
  },
};
