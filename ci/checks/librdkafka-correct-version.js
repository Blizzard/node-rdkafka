const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const pjsPath = path.join(root, 'package.json');

const librdkafkaPath = path.resolve(root, 'deps', 'librdkafka');
const pjs = require(pjsPath);

const majorMask = 0xff000000;
const minorMask = 0x00ff0000;
const patchMask = 0x0000ff00;
const revMask   = 0x000000ff;

// Read the header file
const headerFileLines = fs.readFileSync(path.resolve(librdkafkaPath, 'src', 'rdkafka.h')).toString().split('\n');
const precompilerDefinitions = headerFileLines.filter((line) => line.startsWith('#def'));
const definedLines = precompilerDefinitions.map(definedLine => {
  const content = definedLine.split(' ').filter(v => v != '');

  return {
    command: content[0],
    key: content[1],
    value: content[2]
  };
});

const defines = {};

for (let item of definedLines) {
  if (item.command == '#define') {
    defines[item.key] = item.value;
  }
}

function parseLibrdkafkaVersion(version) {
  const intRepresentation = parseInt(version);

  const major = (intRepresentation & majorMask) >> (8 * 3);
  const minor = (intRepresentation & minorMask) >> (8 * 2);
  const patch = (intRepresentation & patchMask) >> (8 * 1);
  const rev = (intRepresentation & revMask) >> (8 * 0);

  return {
    major,
    minor,
    patch,
    rev
  };
}

function versionAsString(version) {
  return [
    version.major,
    version.minor,
    version.patch,
    version.rev === 255 ? null : version.rev,
  ].filter(v => v != null).join('.');
}

const librdkafkaVersion = parseLibrdkafkaVersion(defines.RD_KAFKA_VERSION);
const versionString = versionAsString(librdkafkaVersion);

if (pjs.librdkafka !== versionString) {
  console.error(`Librdkafka version of ${versionString} does not match package json: ${pjs.librdkafka}`);
  process.exit(1);
}
