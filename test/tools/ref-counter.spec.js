var t = require('assert');
var RefCounter = require('../../lib/tools/ref-counter');

function noop() {}

module.exports = {
  'RefCounter': {
    'is an object': function() {
      t.equal(typeof(RefCounter), 'function');
    },
    'should become active when incremented': function(next) {
      var refCounter = new RefCounter(function() { next(); }, noop);

      refCounter.increment();
    },
    'should become inactive when incremented and decremented': function(next) {
      var refCounter = new RefCounter(noop, function() { next(); });

      refCounter.increment();
      setImmediate(function() {
        refCounter.decrement();
      });
    },
    'should support multiple accesses': function(next) {
      var refCounter = new RefCounter(noop, function() { next(); });

      refCounter.increment();
      refCounter.increment();
      refCounter.decrement();
      setImmediate(function() {
        refCounter.decrement();
      });
    },
    'should be reusable': function(next) {
      var numActives = 0;
      var numPassives = 0;
      var refCounter = new RefCounter(function() {
        numActives += 1;
      }, function() {
        numPassives += 1;

        if (numActives === 2 && numPassives === 2) {
          next();
        }
      });

      refCounter.increment();
      refCounter.decrement();
      refCounter.increment();
      refCounter.decrement();
    }
  }
};
