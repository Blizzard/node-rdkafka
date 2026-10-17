/* Regression for native Dispatcher initialization/send/close ordering. */
var childProcess = require('child_process');
var fs = require('fs');
var os = require('os');
var path = require('path');

module.exports = {
  'Dispatcher lifecycle': {
    'serializes sends with initialization and close': function(done) {
      this.timeout(95000);
      if (process.platform !== 'linux') {
        this.skip();
        return;
      }
      fs.mkdtemp(path.join(os.tmpdir(), 'node-rdkafka-dispatcher-'),
        function(error, output) {
          if (error) return done(error);
          childProcess.execFile('python3', [
            path.join(__dirname, 'tools', 'dispatcher-lifecycle', 'probe.py'),
            '--node', process.execPath, '--output', output
          ], { timeout: 90000 }, function(error, stdout, stderr) {
            if (error) {
              error.message += '\n' + stdout + stderr +
                '\nNative regression evidence: ' + output;
              return done(error);
            }
            fs.rm(output, { recursive: true, force: true }, done);
          });
        });
    }
  }
};
