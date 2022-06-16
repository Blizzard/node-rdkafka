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

function extractConfigItems(configStr) {
  const [_header, config] = configStr.split(/-{5,}\|.*/);

  const re = /(.*?)\|(.*?)\|(.*?)\|(.*?)\|(.*?)\|(.*)/g;

  const configItems = [];

  let m;
  do {
    m = re.exec(config);
    if (m) {
      const [
        _fullString,
        property,
        consumerOrProducer,
        range,
        defaultValue,
        importance,
        descriptionWithType,
      ] = m.map(el => (typeof el === 'string' ? el.trim() : el));

      const splitDescriptionRe = /(.*?)\s*?<br>.*?:\s.*?(.*?)\*/;
      const [_, description, rawType] = splitDescriptionRe.exec(descriptionWithType);

      configItems.push({
        property,
        consumerOrProducer,
        range,
        defaultValue,
        importance,
        description,
        rawType,
      });
    }
  } while (m);

  return configItems.map(processItem);
}

function processItem(configItem) {
  // These items are overwritten by node-rdkafka
  switch (configItem.property) {
    case 'dr_msg_cb':
      return { ...configItem, type: 'boolean' };
    case 'dr_cb':
      return { ...configItem, type: 'boolean | Function' };
    case 'rebalance_cb':
      return { ...configItem, type: 'boolean | Function' };
    case 'offset_commit_cb':
      return { ...configItem, type: 'boolean | Function' };
  }

  switch (configItem.rawType) {
    case 'integer':
      return { ...configItem, type: 'number' };
    case 'boolean':
      return { ...configItem, type: 'boolean' };
    case 'string':
    case 'CSV flags':
      return { ...configItem, type: 'string' };
    case 'enum value':
      return {
        ...configItem,
        type: configItem.range
          .split(',')
          .map(str => `'${str.trim()}'`)
          .join(' | '),
      };
    default:
      return { ...configItem, type: 'any' };
  }
}

function generateInterface(interfaceDef, configItems) {
  const fields = configItems
    .map(item =>
      [
        `/**`,
        ` * ${item.description}`,
        ...(item.defaultValue ? [` *`, ` * @default ${item.defaultValue}`] : []),
        ` */`,
        `"${item.property}"?: ${item.type};`,
      ]
        .map(row => `    ${row}`)
        .join('\n')
    )
    .join('\n\n');

  return `export interface ` + interfaceDef + ' {\n' + fields + '\n}';
}

function addSpecialGlobalProps(globalProps) {
  globalProps.push({
    "property": "event_cb",
    "consumerOrProducer": "*",
    "range": "",
    "defaultValue": "true",
    "importance": "low",
    "description": "Enables or disables `event.*` emitting.",
    "rawType": "boolean",
    "type": "boolean"
  });
}

function generateConfigDTS(file) {
  const configuration = readLibRDKafkaFile(file);
  const [globalStr, topicStr] = configuration.split('Topic configuration properties');

  const [globalProps, topicProps] = [extractConfigItems(globalStr), extractConfigItems(topicStr)];

  addSpecialGlobalProps(globalProps);

  const [globalSharedProps, producerGlobalProps, consumerGlobalProps] = [
    globalProps.filter(i => i.consumerOrProducer === '*'),
    globalProps.filter(i => i.consumerOrProducer === 'P'),
    globalProps.filter(i => i.consumerOrProducer === 'C'),
  ];

  const [topicSharedProps, producerTopicProps, consumerTopicProps] = [
    topicProps.filter(i => i.consumerOrProducer === '*'),
    topicProps.filter(i => i.consumerOrProducer === 'P'),
    topicProps.filter(i => i.consumerOrProducer === 'C'),
  ];

  let output = `${getHeader(file)}
// Code that generated this is a derivative work of the code from Nam Nguyen
// https://gist.github.com/ntgn81/066c2c8ec5b4238f85d1e9168a04e3fb

`;

  output += [
    generateInterface('GlobalConfig', globalSharedProps),
    generateInterface('ProducerGlobalConfig extends GlobalConfig', producerGlobalProps),
    generateInterface('ConsumerGlobalConfig extends GlobalConfig', consumerGlobalProps),
    generateInterface('TopicConfig', topicSharedProps),
    generateInterface('ProducerTopicConfig extends TopicConfig', producerTopicProps),
    generateInterface('ConsumerTopicConfig extends TopicConfig', consumerTopicProps),
  ].join('\n\n');

  fs.writeFileSync(path.resolve(__dirname, '../config.d.ts'), output);
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
    .replace(/((\s+\/\*)|(   ?\*)).*/g, '')
    .replace(/  ERR_\w+: -?\d+,?\r?\n/g, '')
    .trim()
  if (emptyCheck !== '') {
    throw new Error(`Fail to parse ${file}. It contains these extra details:\n${emptyCheck}`);
  }

  const error_js_file = path.resolve(__dirname, '../lib/error.js');
  const error_js = fs.readFileSync(error_js_file)
    .toString()
    .replace(/(\/\/.*\r?\n)?LibrdKafkaError.codes = {[^}]+/g, `${getHeader(file)}\nLibrdKafkaError.codes = {\n${body}`)

  fs.writeFileSync(error_js_file, error_js);
  fs.writeFileSync(path.resolve(__dirname, '../errors.d.ts'), `${getHeader(file)}\nexport const CODES: { ERRORS: {${body.replace(/[ \.]*(\*\/\r?\n  \w+: )(-?\d+),?/g, ' (**$2**) $1number,')}}}`)
}

(async function updateTypeDefs() {
  generateConfigDTS('CONFIGURATION.md');
  updateErrorDefinitions('src-cpp/rdkafkacpp.h');
})()
