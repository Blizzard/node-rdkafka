/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = TestCase;

function TestCase(name, test) {

  this.name = name;
  this.test = test;

}

TestCase.prototype.execute = function(test, cb) {
  var t;
  var fakeCb = function(err) {
    // Reset it so we don't get the callback executed twice
    if (!err) {
      err = new Error('Callback executed after failure');
    }

    console.log(err);
  };

  try {
    test.bind({
      timeout: function(int) {
        if (int) {
          t = setTimeout(function() {
            cb(new Error('Test timed out'));
            cb = fakeCb;
          }, int);
        }
      }
    })(function(err) {
      clearTimeout(t);
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  } catch (e) {
    cb(e);
    cb = fakeCb;
  }
};

TestCase.prototype.run = function(cb) {

  console.log('Running test case: ' + this.name);

  var self = this;
  var t;

  var cases = {};
  try {


    this.test.call({
      test: function(name, testCase) {
        cases[name] = {
          case: testCase
        };
      }
    });

    var names = Object.keys(cases);
    var counter = -1;

    var runNextCase = function(err) {
      if (err) {
        err.case = names[counter];
        err.suite = self.name;
        TestCase.printError(err);
        process.exitCode = 1;
        return cb(err);
      }
      counter++;

      if (counter > 0) {
        TestCase.printSuccess({ suite: self.name, case: names[counter-1] });
      }

      var testCase = cases[names[counter]];

      if (!testCase) {
        // Done.
        cb();
      } else {
        self.execute(testCase.case, runNextCase);
      }
    };

    runNextCase();

  } catch (err) {
    cb(err);
  }
};

TestCase.printError = function(err) {
  // First log the test case
  console.error(err.suite + ': ' + err.case + ' - ERROR! ' + err.message);
  console.error(err.stack);
};

TestCase.printSuccess = function(obj) {
  console.info(obj.suite + ': ' + obj.case + ' - passed');
};
