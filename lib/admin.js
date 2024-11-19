/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
'use strict';

module.exports = {
  create: createAdminClient,
};

var Client = require('./client');
var util = require('util');
var Kafka = require('../librdkafka');
var LibrdKafkaError = require('./error');
var shallowCopy = require('./util').shallowCopy;

/**
 * Create a new AdminClient for making topics, partitions, and more.
 *
 * This is a factory method because it immediately starts an
 * active handle with the brokers.
 *
 */
function createAdminClient(conf, initOauthBearerToken) {
  var client = new AdminClient(conf);

  if (initOauthBearerToken) {
    client.refreshOauthBearerToken(initOauthBearerToken);
  }

  // Wrap the error so we throw if it failed with some context
  LibrdKafkaError.wrap(client.connect(), true);

  // Return the client if we succeeded
  return client;
}

/**
 * AdminClient class for administering Kafka
 *
 * This client is the way you can interface with the Kafka Admin APIs.
 * This class should not be made using the constructor, but instead
 * should be made using the factory method.
 *
 * <code>
 * var client = AdminClient.create({ ... });
 * </code>
 *
 * Once you instantiate this object, it will have a handle to the kafka broker.
 * Unlike the other node-rdkafka classes, this class does not ensure that
 * it is connected to the upstream broker. Instead, making an action will
 * validate that.
 *
 * @param {object} conf - Key value pairs to configure the admin client
 * topic configuration
 * @constructor
 */
function AdminClient(conf) {
  if (!(this instanceof AdminClient)) {
    return new AdminClient(conf);
  }

  conf = shallowCopy(conf);

  /**
   * NewTopic model.
   *
   * This is the representation of a new message that is requested to be made
   * using the Admin client.
   *
   * @typedef {object} AdminClient~NewTopic
   * @property {string} topic - the topic name to create
   * @property {number} num_partitions - the number of partitions to give the topic
   * @property {number} replication_factor - the replication factor of the topic
   * @property {object} config - a list of key values to be passed as configuration
   * for the topic.
   */

  this._client = new Kafka.AdminClient(conf);
  this._isConnected = false;
  this.globalConfig = conf;
}

/**
 * Connect using the admin client.
 *
 * Should be run using the factory method, so should never
 * need to be called outside.
 *
 * Unlike the other connect methods, this one is synchronous.
 */
AdminClient.prototype.connect = function() {
  LibrdKafkaError.wrap(this._client.connect(), true);
  this._isConnected = true;
};

/**
 * Disconnect the admin client.
 *
 * This is a synchronous method, but all it does is clean up
 * some memory and shut some threads down
 */
AdminClient.prototype.disconnect = function() {
  LibrdKafkaError.wrap(this._client.disconnect(), true);
  this._isConnected = false;
};

/**
 * Refresh OAuthBearer token, initially provided in factory method.
 * Expiry is always set to maximum value, as the callback of librdkafka
 * for token refresh is not used.
 *
 * @param {string} tokenStr - OAuthBearer token string
 * @see connection.cc
 */
AdminClient.prototype.refreshOauthBearerToken = function (tokenStr) {
  if (!tokenStr || typeof tokenStr !== 'string') {
    throw new Error("OAuthBearer token is undefined/empty or not a string");
  }

  this._client.setToken(tokenStr);
};

/**
 * Create a topic with a given config.
 *
 * @param {NewTopic} topic - Topic to create.
 * @param {number} timeout - Number of milliseconds to wait while trying to create the topic.
 * @param {function} cb - The callback to be executed when finished
 */
AdminClient.prototype.createTopic = function(topic, timeout, cb) {
  if (!this._isConnected) {
    throw new Error('Client is disconnected');
  }

  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }

  if (!timeout) {
    timeout = 5000;
  }

  this._client.createTopic(topic, timeout, function(err) {
    if (err) {
      if (cb) {
        cb(LibrdKafkaError.create(err));
      }
      return;
    }

    if (cb) {
      cb();
    }
  });
};

/**
 * Delete a topic.
 *
 * @param {string} topic - The topic to delete, by name.
 * @param {number} timeout - Number of milliseconds to wait while trying to delete the topic.
 * @param {function} cb - The callback to be executed when finished
 */
AdminClient.prototype.deleteTopic = function(topic, timeout, cb) {
  if (!this._isConnected) {
    throw new Error('Client is disconnected');
  }

  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }

  if (!timeout) {
    timeout = 5000;
  }

  this._client.deleteTopic(topic, timeout, function(err) {
    if (err) {
      if (cb) {
        cb(LibrdKafkaError.create(err));
      }
      return;
    }

    if (cb) {
      cb();
    }
  });
};

/**
 * Create new partitions for a topic.
 *
 * @param {string} topic - The topic to add partitions to, by name.
 * @param {number} totalPartitions - The total number of partitions the topic should have
 *                                   after the request
 * @param {number} timeout - Number of milliseconds to wait while trying to create the partitions.
 * @param {function} cb - The callback to be executed when finished
 */
AdminClient.prototype.createPartitions = function(topic, totalPartitions, timeout, cb) {
  if (!this._isConnected) {
    throw new Error('Client is disconnected');
  }

  if (typeof timeout === 'function') {
    cb = timeout;
    timeout = 5000;
  }

  if (!timeout) {
    timeout = 5000;
  }

  this._client.createPartitions(topic, totalPartitions, timeout, function(err) {
    if (err) {
      if (cb) {
        cb(LibrdKafkaError.create(err));
      }
      return;
    }

    if (cb) {
      cb();
    }
  });
};
