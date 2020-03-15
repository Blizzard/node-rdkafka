const fs = require('fs');
const path = require('path');

const LIBRDKAFKA_VERSION = require('../package.json').librdkafka;
const LIBRDKAFKA_DIR = path.resolve(__dirname, '../deps/librdkafka/');

function getHeader(file) {
  return `// ====== Generated from librdkafka ${LIBRDKAFKA_VERSION} file ${file} ======`;
}

function readLibRDKafkaFile(file) {
  return fs.readFileSync(path.resolve(LIBRDKAFKA_DIR, file)).toString();
}

function updateErrorDefinitions(file) {
  const rdkafkacpp_h = readLibRDKafkaFile(file);
  const m = /enum ErrorCode {([^}]+)}/g.exec(rdkafkacpp_h);
  if (!m) {
    throw new Error(`Can't read rdkafkacpp.h file`)
  }
  const body = m[1]
    .replace(/(\t)|(  +)/g, '  ')
    .replace(/\n\n/g, '\n')
    .replace(/\s+=\s+/g, ': ')
    .replace(/[\t ]*#define +(\w+) +(\w+)/g, (_, define, original) => {
      const value = new RegExp(`${original}\\s+=\\s+(\\d+)`).exec(m[1])[1];
      return `  ${define}: ${value},`;
    })

  // validate body
  const emptyCheck = body
    .replace(/((  \/\*)|(   ?\*)).*/g, '')
    .replace(/  ERR_\w+: -?\d+,\n/g, '')
    .trim()
  if (emptyCheck !== '') {
    throw new Error(`Fail to parse ${file}. It contains these extra details:\n${emptyCheck}`);
  }

  const error_js_file = path.resolve(__dirname, '../lib/error.js');
  const error_js = fs.readFileSync(error_js_file)
    .toString()
    .replace(/(\/\/.*\n)?LibrdKafkaError.codes = {[^}]+/g, `${getHeader(file)}\nLibrdKafkaError.codes = {\n${body}`)

  fs.writeFileSync(error_js_file, error_js);
  fs.writeFileSync(path.resolve(__dirname, '../errors.d.ts'), `${getHeader(file)}\nexport const CODES: { ERRORS: {${body.replace(/[ \.]*(\*\/\n  \w+: )(-?\d+),/g, ' (**$2**) $1number,')}}}`)
}

(async function updateTypeDefs() {
  updateErrorDefinitions('src-cpp/rdkafkacpp.h');
})()