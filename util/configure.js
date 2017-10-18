'use strict';

var query = process.argv[2];

var fs = require('fs');
var path = require('path');

var baseDir = path.resolve(__dirname, '../');

var isWin = /^win/.test(process.platform);

// Skip running this if we are running on a windows system
if (isWin) {
  process.exit(0);
}

var childProcess = require('child_process');

try {
  childProcess.execSync('./configure', {
    cwd: baseDir,
    stdio: [0,1,2]
  });
  process.exit(0);
} catch (e) {
  process.exit(1);
}
