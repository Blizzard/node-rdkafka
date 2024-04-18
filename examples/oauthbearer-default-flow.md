Producer, Consumer and HighLevelProducer:
```js
/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Kafka = require('../');

var token = "your_token";

var producer = new Kafka.Producer({
  //'debug' : 'all',
  'metadata.broker.list': 'localhost:9093',
  'security.protocol': 'SASL_SSL',
	'sasl.mechanisms': 'OAUTHBEARER',
}).setOauthBearerToken(token);

//start the producer
producer.connect();

//refresh the token
producer.setOauthBearerToken(token);
```

AdminClient:
```js
/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
var Kafka = require('../');

var token = "your_token";

var admin = Kafka.AdminClient.create({
		'metadata.broker.list': 'localhost:9093',
		'security.protocol': 'SASL_SSL',
		'sasl.mechanisms': 'OAUTHBEARER',
}, token);

//refresh the token
admin.refreshOauthBearerToken(token);
```

ConsumerStream:
```js
/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */
var Kafka = require('../');

var token = "your_token";

var stream = Kafka.KafkaConsumer.createReadStream({
        'metadata.broker.list': 'localhost:9093',
        'group.id': 'myGroup',
        'security.protocol': 'SASL_SSL',
        'sasl.mechanisms': 'OAUTHBEARER'
    }, {}, {
        topics: 'test1',
        initOauthBearerToken: token,
    });

//refresh the token
stream.refreshOauthBearerToken(token.token);
```
