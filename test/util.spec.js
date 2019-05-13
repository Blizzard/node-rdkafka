/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var shallowCopy = require('../lib/util').shallowCopy;
var t = require('assert');

module.exports = {
  'shallowCopy utility': {
    'returns value itself when it is not an object': function () {
      t.strictEqual(10, shallowCopy(10));
      t.strictEqual('str', shallowCopy('str'));
      t.strictEqual(null, shallowCopy(null));
      t.strictEqual(undefined, shallowCopy(undefined));
      t.strictEqual(false, shallowCopy(false));
    },
    'returns shallow copy of the passed object': function () {
      var obj = {
        sub: { a: 10 },
        b: 'str',
      };
      var copy = shallowCopy(obj);

      t.notEqual(obj, copy);
      t.deepStrictEqual(obj, copy);
      t.equal(obj.sub, copy.sub);
    },
    'does not copy non-enumerable and inherited properties': function () {
      var obj = Object.create({
        a: 10,
      }, {
        b: { value: 'str' },
        c: { value: true, enumerable: true },
      });
      var copy = shallowCopy(obj);

      t.notEqual(obj, copy);
      t.deepStrictEqual(copy, { c: true });
    },
  },
};
