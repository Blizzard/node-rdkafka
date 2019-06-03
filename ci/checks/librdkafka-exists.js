const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const librdkafkaPath = path.resolve(root, 'deps', 'librdkafka');

// Ensure librdkafka is in the deps directory - this makes sure we don't accidentally
// publish on a non recursive clone :)

if (!fs.existsSync(librdkafkaPath)) {
  console.error(`Could not find librdkafka at path ${librdkafkaPath}`);
  process.exit(1);
}
