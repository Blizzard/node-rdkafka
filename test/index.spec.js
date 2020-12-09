/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

const worker = require('worker_threads');
const t = require('assert');

module.exports = {
  'Node package': {
    'should not throw an error when module is loaded inside a worker': function() {
      t.doesNotThrow(function() {
        new worker.Worker('require("./librdkafka.js")', { eval: true })
      })
    },
  }
}
