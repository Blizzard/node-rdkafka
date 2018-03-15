var kafka = require('../lib');

var p = new kafka.Producer({ 'bootstrap.servers': 'localhost:9092' }, {});

p.connect({ timeout: 1000 }, function(err) {
  if (!err) {
    p.disconnect();
  } else {
    process.exit(0);
  }
});
