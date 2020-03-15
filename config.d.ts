// ====== Generated from librdkafka 1.3.0 file CONFIGURATION.md ======
// Code that generated this is a derivative work of the code from Nam Nguyen
// https://gist.github.com/ntgn81/066c2c8ec5b4238f85d1e9168a04e3fb

export interface GlobalConfig {
    /**
     * Indicates the builtin features for this build of librdkafka. An application can either query this value or attempt to set it with its list of required features to check for library support.
     *
     * @default gzip, snappy, ssl, sasl, regex, lz4, sasl_gssapi, sasl_plain, sasl_scram, plugins, zstd, sasl_oauthbearer
     */
    "builtin.features"?: string;

    /**
     * Client identifier.
     *
     * @default rdkafka
     */
    "client.id"?: string;

    /**
     * Initial list of brokers as a CSV list of broker host or host:port. The application may also use `rd_kafka_brokers_add()` to add brokers during runtime.
     */
    "metadata.broker.list"?: string;

    /**
     * Alias for `metadata.broker.list`: Initial list of brokers as a CSV list of broker host or host:port. The application may also use `rd_kafka_brokers_add()` to add brokers during runtime.
     */
    "bootstrap.servers"?: string;

    /**
     * Maximum Kafka protocol request message size. Due to differing framing overhead between protocol versions the producer is unable to reliably enforce a strict max message limit at produce time and may exceed the maximum size by one message in protocol ProduceRequests, the broker will enforce the the topic's `max.message.bytes` limit (see Apache Kafka documentation).
     *
     * @default 1000000
     */
    "message.max.bytes"?: number;

    /**
     * Maximum size for message to be copied to buffer. Messages larger than this will be passed by reference (zero-copy) at the expense of larger iovecs.
     *
     * @default 65535
     */
    "message.copy.max.bytes"?: number;

    /**
     * Maximum Kafka protocol response message size. This serves as a safety precaution to avoid memory exhaustion in case of protocol hickups. This value must be at least `fetch.max.bytes`  + 512 to allow for protocol overhead; the value is adjusted automatically unless the configuration property is explicitly set.
     *
     * @default 100000000
     */
    "receive.message.max.bytes"?: number;

    /**
     * Maximum number of in-flight requests per broker connection. This is a generic property applied to all broker communication, however it is primarily relevant to produce requests. In particular, note that other mechanisms limit the number of outstanding consumer fetch request per broker to one.
     *
     * @default 1000000
     */
    "max.in.flight.requests.per.connection"?: number;

    /**
     * Alias for `max.in.flight.requests.per.connection`: Maximum number of in-flight requests per broker connection. This is a generic property applied to all broker communication, however it is primarily relevant to produce requests. In particular, note that other mechanisms limit the number of outstanding consumer fetch request per broker to one.
     *
     * @default 1000000
     */
    "max.in.flight"?: number;

    /**
     * Non-topic request timeout in milliseconds. This is for metadata requests, etc.
     *
     * @default 60000
     */
    "metadata.request.timeout.ms"?: number;

    /**
     * Period of time in milliseconds at which topic and broker metadata is refreshed in order to proactively discover any new brokers, topics, partitions or partition leader changes. Use -1 to disable the intervalled refresh (not recommended). If there are no locally referenced topics (no topic objects created, no messages produced, no subscription or no assignment) then only the broker list will be refreshed every interval but no more often than every 10s.
     *
     * @default 300000
     */
    "topic.metadata.refresh.interval.ms"?: number;

    /**
     * Metadata cache max age. Defaults to topic.metadata.refresh.interval.ms * 3
     *
     * @default 900000
     */
    "metadata.max.age.ms"?: number;

    /**
     * When a topic loses its leader a new metadata request will be enqueued with this initial interval, exponentially increasing until the topic metadata has been refreshed. This is used to recover quickly from transitioning leader brokers.
     *
     * @default 250
     */
    "topic.metadata.refresh.fast.interval.ms"?: number;

    /**
     * **DEPRECATED** No longer used.
     *
     * @default 10
     */
    "topic.metadata.refresh.fast.cnt"?: number;

    /**
     * Sparse metadata requests (consumes less network bandwidth)
     *
     * @default true
     */
    "topic.metadata.refresh.sparse"?: boolean;

    /**
     * Topic blacklist, a comma-separated list of regular expressions for matching topic names that should be ignored in broker metadata information as if the topics did not exist.
     */
    "topic.blacklist"?: any;

    /**
     * A comma-separated list of debug contexts to enable. Detailed Producer debugging: broker,topic,msg. Consumer: consumer,cgrp,topic,fetch
     */
    "debug"?: string;

    /**
     * Default timeout for network requests. Producer: ProduceRequests will use the lesser value of `socket.timeout.ms` and remaining `message.timeout.ms` for the first message in the batch. Consumer: FetchRequests will use `fetch.wait.max.ms` + `socket.timeout.ms`. Admin: Admin requests will use `socket.timeout.ms` or explicitly set `rd_kafka_AdminOptions_set_operation_timeout()` value.
     *
     * @default 60000
     */
    "socket.timeout.ms"?: number;

    /**
     * **DEPRECATED** No longer used.
     *
     * @default 1000
     */
    "socket.blocking.max.ms"?: number;

    /**
     * Broker socket send buffer size. System default is used if 0.
     *
     * @default 0
     */
    "socket.send.buffer.bytes"?: number;

    /**
     * Broker socket receive buffer size. System default is used if 0.
     *
     * @default 0
     */
    "socket.receive.buffer.bytes"?: number;

    /**
     * Enable TCP keep-alives (SO_KEEPALIVE) on broker sockets
     *
     * @default false
     */
    "socket.keepalive.enable"?: boolean;

    /**
     * Disable the Nagle algorithm (TCP_NODELAY) on broker sockets.
     *
     * @default false
     */
    "socket.nagle.disable"?: boolean;

    /**
     * Disconnect from broker when this number of send failures (e.g., timed out requests) is reached. Disable with 0. WARNING: It is highly recommended to leave this setting at its default value of 1 to avoid the client and broker to become desynchronized in case of request timeouts. NOTE: The connection is automatically re-established.
     *
     * @default 1
     */
    "socket.max.fails"?: number;

    /**
     * How long to cache the broker address resolving results (milliseconds).
     *
     * @default 1000
     */
    "broker.address.ttl"?: number;

    /**
     * Allowed broker IP address families: any, v4, v6
     *
     * @default any
     */
    "broker.address.family"?: 'any' | 'v4' | 'v6';

    /**
     * **DEPRECATED** No longer used. See `reconnect.backoff.ms` and `reconnect.backoff.max.ms`.
     *
     * @default 0
     */
    "reconnect.backoff.jitter.ms"?: number;

    /**
     * The initial time to wait before reconnecting to a broker after the connection has been closed. The time is increased exponentially until `reconnect.backoff.max.ms` is reached. -25% to +50% jitter is applied to each reconnect backoff. A value of 0 disables the backoff and reconnects immediately.
     *
     * @default 100
     */
    "reconnect.backoff.ms"?: number;

    /**
     * The maximum time to wait before reconnecting to a broker after the connection has been closed.
     *
     * @default 10000
     */
    "reconnect.backoff.max.ms"?: number;

    /**
     * librdkafka statistics emit interval. The application also needs to register a stats callback using `rd_kafka_conf_set_stats_cb()`. The granularity is 1000ms. A value of 0 disables statistics.
     *
     * @default 0
     */
    "statistics.interval.ms"?: number;

    /**
     * See `rd_kafka_conf_set_events()`
     *
     * @default 0
     */
    "enabled_events"?: number;

    /**
     * Error callback (set with rd_kafka_conf_set_error_cb())
     */
    "error_cb"?: any;

    /**
     * Throttle callback (set with rd_kafka_conf_set_throttle_cb())
     */
    "throttle_cb"?: any;

    /**
     * Statistics callback (set with rd_kafka_conf_set_stats_cb())
     */
    "stats_cb"?: any;

    /**
     * Log callback (set with rd_kafka_conf_set_log_cb())
     */
    "log_cb"?: any;

    /**
     * Logging level (syslog(3) levels)
     *
     * @default 6
     */
    "log_level"?: number;

    /**
     * Disable spontaneous log_cb from internal librdkafka threads, instead enqueue log messages on queue set with `rd_kafka_set_log_queue()` and serve log callbacks or events through the standard poll APIs. **NOTE**: Log messages will linger in a temporary queue until the log queue has been set.
     *
     * @default false
     */
    "log.queue"?: boolean;

    /**
     * Print internal thread name in log messages (useful for debugging librdkafka internals)
     *
     * @default true
     */
    "log.thread.name"?: boolean;

    /**
     * Log broker disconnects. It might be useful to turn this off when interacting with 0.9 brokers with an aggressive `connection.max.idle.ms` value.
     *
     * @default true
     */
    "log.connection.close"?: boolean;

    /**
     * Background queue event callback (set with rd_kafka_conf_set_background_event_cb())
     */
    "background_event_cb"?: any;

    /**
     * Socket creation callback to provide race-free CLOEXEC
     */
    "socket_cb"?: any;

    /**
     * Socket connect callback
     */
    "connect_cb"?: any;

    /**
     * Socket close callback
     */
    "closesocket_cb"?: any;

    /**
     * File open callback to provide race-free CLOEXEC
     */
    "open_cb"?: any;

    /**
     * Application opaque (set with rd_kafka_conf_set_opaque())
     */
    "opaque"?: any;

    /**
     * Default topic configuration for automatically subscribed topics
     */
    "default_topic_conf"?: any;

    /**
     * Signal that librdkafka will use to quickly terminate on rd_kafka_destroy(). If this signal is not set then there will be a delay before rd_kafka_wait_destroyed() returns true as internal threads are timing out their system calls. If this signal is set however the delay will be minimal. The application should mask this signal as an internal signal handler is installed.
     *
     * @default 0
     */
    "internal.termination.signal"?: number;

    /**
     * Request broker's supported API versions to adjust functionality to available protocol features. If set to false, or the ApiVersionRequest fails, the fallback version `broker.version.fallback` will be used. **NOTE**: Depends on broker version >=0.10.0. If the request is not supported by (an older) broker the `broker.version.fallback` fallback is used.
     *
     * @default true
     */
    "api.version.request"?: boolean;

    /**
     * Timeout for broker API version requests.
     *
     * @default 10000
     */
    "api.version.request.timeout.ms"?: number;

    /**
     * Dictates how long the `broker.version.fallback` fallback is used in the case the ApiVersionRequest fails. **NOTE**: The ApiVersionRequest is only issued when a new connection to the broker is made (such as after an upgrade).
     *
     * @default 0
     */
    "api.version.fallback.ms"?: number;

    /**
     * Older broker versions (before 0.10.0) provide no way for a client to query for supported protocol features (ApiVersionRequest, see `api.version.request`) making it impossible for the client to know what features it may use. As a workaround a user may set this property to the expected broker version and the client will automatically adjust its feature set accordingly if the ApiVersionRequest fails (or is disabled). The fallback broker version will be used for `api.version.fallback.ms`. Valid values are: 0.9.0, 0.8.2, 0.8.1, 0.8.0. Any other value >= 0.10, such as 0.10.2.1, enables ApiVersionRequests.
     *
     * @default 0.10.0
     */
    "broker.version.fallback"?: string;

    /**
     * Protocol used to communicate with brokers.
     *
     * @default plaintext
     */
    "security.protocol"?: 'plaintext' | 'ssl' | 'sasl_plaintext' | 'sasl_ssl';

    /**
     * A cipher suite is a named combination of authentication, encryption, MAC and key exchange algorithm used to negotiate the security settings for a network connection using TLS or SSL network protocol. See manual page for `ciphers(1)` and `SSL_CTX_set_cipher_list(3).
     */
    "ssl.cipher.suites"?: string;

    /**
     * The supported-curves extension in the TLS ClientHello message specifies the curves (standard/named, or 'explicit' GF(2^k) or GF(p)) the client is willing to have the server use. See manual page for `SSL_CTX_set1_curves_list(3)`. OpenSSL >= 1.0.2 required.
     */
    "ssl.curves.list"?: string;

    /**
     * The client uses the TLS ClientHello signature_algorithms extension to indicate to the server which signature/hash algorithm pairs may be used in digital signatures. See manual page for `SSL_CTX_set1_sigalgs_list(3)`. OpenSSL >= 1.0.2 required.
     */
    "ssl.sigalgs.list"?: string;

    /**
     * Path to client's private key (PEM) used for authentication.
     */
    "ssl.key.location"?: string;

    /**
     * Private key passphrase (for use with `ssl.key.location` and `set_ssl_cert()`)
     */
    "ssl.key.password"?: string;

    /**
     * Client's private key string (PEM format) used for authentication.
     */
    "ssl.key.pem"?: string;

    /**
     * Client's private key as set by rd_kafka_conf_set_ssl_cert()
     */
    "ssl_key"?: any;

    /**
     * Path to client's public key (PEM) used for authentication.
     */
    "ssl.certificate.location"?: string;

    /**
     * Client's public key string (PEM format) used for authentication.
     */
    "ssl.certificate.pem"?: string;

    /**
     * Client's public key as set by rd_kafka_conf_set_ssl_cert()
     */
    "ssl_certificate"?: any;

    /**
     * File or directory path to CA certificate(s) for verifying the broker's key.
     */
    "ssl.ca.location"?: string;

    /**
     * CA certificate as set by rd_kafka_conf_set_ssl_cert()
     */
    "ssl_ca"?: any;

    /**
     * Path to CRL for verifying broker's certificate validity.
     */
    "ssl.crl.location"?: string;

    /**
     * Path to client's keystore (PKCS#12) used for authentication.
     */
    "ssl.keystore.location"?: string;

    /**
     * Client's keystore (PKCS#12) password.
     */
    "ssl.keystore.password"?: string;

    /**
     * Enable OpenSSL's builtin broker (server) certificate verification. This verification can be extended by the application by implementing a certificate_verify_cb.
     *
     * @default true
     */
    "enable.ssl.certificate.verification"?: boolean;

    /**
     * Endpoint identification algorithm to validate broker hostname using broker certificate. https - Server (broker) hostname verification as specified in RFC2818. none - No endpoint verification. OpenSSL >= 1.0.2 required.
     *
     * @default none
     */
    "ssl.endpoint.identification.algorithm"?: 'none' | 'https';

    /**
     * Callback to verify the broker certificate chain.
     */
    "ssl.certificate.verify_cb"?: any;

    /**
     * SASL mechanism to use for authentication. Supported: GSSAPI, PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER. **NOTE**: Despite the name only one mechanism must be configured.
     *
     * @default GSSAPI
     */
    "sasl.mechanisms"?: string;

    /**
     * Alias for `sasl.mechanisms`: SASL mechanism to use for authentication. Supported: GSSAPI, PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, OAUTHBEARER. **NOTE**: Despite the name only one mechanism must be configured.
     *
     * @default GSSAPI
     */
    "sasl.mechanism"?: string;

    /**
     * Kerberos principal name that Kafka runs as, not including /hostname@REALM
     *
     * @default kafka
     */
    "sasl.kerberos.service.name"?: string;

    /**
     * This client's Kerberos principal name. (Not supported on Windows, will use the logon user's principal).
     *
     * @default kafkaclient
     */
    "sasl.kerberos.principal"?: string;

    /**
     * kinit -t "%{sasl.kerberos.keytab}" -k %{sasl.kerberos.principal} | low        | Shell command to refresh or acquire the client's Kerberos ticket. This command is executed on client creation and every sasl.kerberos.min.time.before.relogin (0=disable). %{config.prop.name} is replaced by corresponding config object value.
     *
     * @default kinit -R -t "%{sasl.kerberos.keytab}" -k %{sasl.kerberos.principal} \
     */
    "sasl.kerberos.kinit.cmd"?: string;

    /**
     * Path to Kerberos keytab file. This configuration property is only used as a variable in `sasl.kerberos.kinit.cmd` as ` ... -t "%{sasl.kerberos.keytab}"`.
     */
    "sasl.kerberos.keytab"?: string;

    /**
     * Minimum time in milliseconds between key refresh attempts. Disable automatic key refresh by setting this property to 0.
     *
     * @default 60000
     */
    "sasl.kerberos.min.time.before.relogin"?: number;

    /**
     * SASL username for use with the PLAIN and SASL-SCRAM-.. mechanisms
     */
    "sasl.username"?: string;

    /**
     * SASL password for use with the PLAIN and SASL-SCRAM-.. mechanism
     */
    "sasl.password"?: string;

    /**
     * SASL/OAUTHBEARER configuration. The format is implementation-dependent and must be parsed accordingly. The default unsecured token implementation (see https://tools.ietf.org/html/rfc7515#appendix-A.5) recognizes space-separated name=value pairs with valid names including principalClaimName, principal, scopeClaimName, scope, and lifeSeconds. The default value for principalClaimName is "sub", the default value for scopeClaimName is "scope", and the default value for lifeSeconds is 3600. The scope value is CSV format with the default value being no/empty scope. For example: `principalClaimName=azp principal=admin scopeClaimName=roles scope=role1,role2 lifeSeconds=600`. In addition, SASL extensions can be communicated to the broker via `extension_<extensionname>=value`. For example: `principal=admin extension_traceId=123`
     */
    "sasl.oauthbearer.config"?: string;

    /**
     * Enable the builtin unsecure JWT OAUTHBEARER token handler if no oauthbearer_refresh_cb has been set. This builtin handler should only be used for development or testing, and not in production.
     *
     * @default false
     */
    "enable.sasl.oauthbearer.unsecure.jwt"?: boolean;

    /**
     * SASL/OAUTHBEARER token refresh callback (set with rd_kafka_conf_set_oauthbearer_token_refresh_cb(), triggered by rd_kafka_poll(), et.al. This callback will be triggered when it is time to refresh the client's OAUTHBEARER token.
     */
    "oauthbearer_token_refresh_cb"?: any;

    /**
     * List of plugin libraries to load (; separated). The library search path is platform dependent (see dlopen(3) for Unix and LoadLibrary() for Windows). If no filename extension is specified the platform-specific extension (such as .dll or .so) will be appended automatically.
     */
    "plugin.library.paths"?: string;

    /**
     * Interceptors added through rd_kafka_conf_interceptor_add_..() and any configuration handled by interceptors.
     */
    "interceptors"?: any;

    /**
     * A rack identifier for this client. This can be any string value which indicates where this client is physically located. It corresponds with the broker config `broker.rack`.
     */
    "client.rack"?: string;
}

export interface ProducerGlobalConfig extends GlobalConfig {
    /**
     * When set to `true`, the producer will ensure that messages are successfully produced exactly once and in the original produce order. The following configuration properties are adjusted automatically (if not modified by the user) when idempotence is enabled: `max.in.flight.requests.per.connection=5` (must be less than or equal to 5), `retries=INT32_MAX` (must be greater than 0), `acks=all`, `queuing.strategy=fifo`. Producer instantation will fail if user-supplied configuration is incompatible.
     *
     * @default false
     */
    "enable.idempotence"?: boolean;

    /**
     * **EXPERIMENTAL**: subject to change or removal. When set to `true`, any error that could result in a gap in the produced message series when a batch of messages fails, will raise a fatal error (ERR__GAPLESS_GUARANTEE) and stop the producer. Messages failing due to `message.timeout.ms` are not covered by this guarantee. Requires `enable.idempotence=true`.
     *
     * @default false
     */
    "enable.gapless.guarantee"?: boolean;

    /**
     * Maximum number of messages allowed on the producer queue. This queue is shared by all topics and partitions.
     *
     * @default 100000
     */
    "queue.buffering.max.messages"?: number;

    /**
     * Maximum total message size sum allowed on the producer queue. This queue is shared by all topics and partitions. This property has higher priority than queue.buffering.max.messages.
     *
     * @default 1048576
     */
    "queue.buffering.max.kbytes"?: number;

    /**
     * Delay in milliseconds to wait for messages in the producer queue to accumulate before constructing message batches (MessageSets) to transmit to brokers. A higher value allows larger and more effective (less overhead, improved compression) batches of messages to accumulate at the expense of increased message delivery latency.
     *
     * @default 0.5
     */
    "queue.buffering.max.ms"?: any;

    /**
     * Alias for `queue.buffering.max.ms`: Delay in milliseconds to wait for messages in the producer queue to accumulate before constructing message batches (MessageSets) to transmit to brokers. A higher value allows larger and more effective (less overhead, improved compression) batches of messages to accumulate at the expense of increased message delivery latency.
     *
     * @default 0.5
     */
    "linger.ms"?: any;

    /**
     * How many times to retry sending a failing Message. **Note:** retrying may cause reordering unless `enable.idempotence` is set to true.
     *
     * @default 2
     */
    "message.send.max.retries"?: number;

    /**
     * Alias for `message.send.max.retries`: How many times to retry sending a failing Message. **Note:** retrying may cause reordering unless `enable.idempotence` is set to true.
     *
     * @default 2
     */
    "retries"?: number;

    /**
     * The backoff time in milliseconds before retrying a protocol request.
     *
     * @default 100
     */
    "retry.backoff.ms"?: number;

    /**
     * The threshold of outstanding not yet transmitted broker requests needed to backpressure the producer's message accumulator. If the number of not yet transmitted requests equals or exceeds this number, produce request creation that would have otherwise been triggered (for example, in accordance with linger.ms) will be delayed. A lower number yields larger and more effective batches. A higher value can improve latency when using compression on slow machines.
     *
     * @default 1
     */
    "queue.buffering.backpressure.threshold"?: number;

    /**
     * compression codec to use for compressing message sets. This is the default value for all topics, may be overridden by the topic configuration property `compression.codec`.
     *
     * @default none
     */
    "compression.codec"?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';

    /**
     * Alias for `compression.codec`: compression codec to use for compressing message sets. This is the default value for all topics, may be overridden by the topic configuration property `compression.codec`.
     *
     * @default none
     */
    "compression.type"?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';

    /**
     * Maximum number of messages batched in one MessageSet. The total MessageSet size is also limited by message.max.bytes.
     *
     * @default 10000
     */
    "batch.num.messages"?: number;

    /**
     * Only provide delivery reports for failed messages.
     *
     * @default false
     */
    "delivery.report.only.error"?: boolean;

    /**
     * Delivery report callback (set with rd_kafka_conf_set_dr_cb())
     */
    "dr_cb"?: boolean | Function;

    /**
     * Delivery report callback (set with rd_kafka_conf_set_dr_msg_cb())
     */
    "dr_msg_cb"?: boolean;
}

export interface ConsumerGlobalConfig extends GlobalConfig {
    /**
     * Client group id string. All clients sharing the same group.id belong to the same group.
     */
    "group.id"?: string;

    /**
     * Name of partition assignment strategy to use when elected group leader assigns partitions to group members.
     *
     * @default range,roundrobin
     */
    "partition.assignment.strategy"?: string;

    /**
     * Client group session and failure detection timeout. The consumer sends periodic heartbeats (heartbeat.interval.ms) to indicate its liveness to the broker. If no hearts are received by the broker for a group member within the session timeout, the broker will remove the consumer from the group and trigger a rebalance. The allowed range is configured with the **broker** configuration properties `group.min.session.timeout.ms` and `group.max.session.timeout.ms`. Also see `max.poll.interval.ms`.
     *
     * @default 10000
     */
    "session.timeout.ms"?: number;

    /**
     * Group session keepalive heartbeat interval.
     *
     * @default 3000
     */
    "heartbeat.interval.ms"?: number;

    /**
     * Group protocol type
     *
     * @default consumer
     */
    "group.protocol.type"?: string;

    /**
     * How often to query for the current client group coordinator. If the currently assigned coordinator is down the configured query interval will be divided by ten to more quickly recover in case of coordinator reassignment.
     *
     * @default 600000
     */
    "coordinator.query.interval.ms"?: number;

    /**
     * Maximum allowed time between calls to consume messages (e.g., rd_kafka_consumer_poll()) for high-level consumers. If this interval is exceeded the consumer is considered failed and the group will rebalance in order to reassign the partitions to another consumer group member. Warning: Offset commits may be not possible at this point. Note: It is recommended to set `enable.auto.offset.store=false` for long-time processing applications and then explicitly store offsets (using offsets_store()) *after* message processing, to make sure offsets are not auto-committed prior to processing has finished. The interval is checked two times per second. See KIP-62 for more information.
     *
     * @default 300000
     */
    "max.poll.interval.ms"?: number;

    /**
     * Automatically and periodically commit offsets in the background. Note: setting this to false does not prevent the consumer from fetching previously committed start offsets. To circumvent this behaviour set specific start offsets per partition in the call to assign().
     *
     * @default true
     */
    "enable.auto.commit"?: boolean;

    /**
     * The frequency in milliseconds that the consumer offsets are committed (written) to offset storage. (0 = disable). This setting is used by the high-level consumer.
     *
     * @default 5000
     */
    "auto.commit.interval.ms"?: number;

    /**
     * Automatically store offset of last message provided to application. The offset store is an in-memory store of the next offset to (auto-)commit for each partition.
     *
     * @default true
     */
    "enable.auto.offset.store"?: boolean;

    /**
     * Minimum number of messages per topic+partition librdkafka tries to maintain in the local consumer queue.
     *
     * @default 100000
     */
    "queued.min.messages"?: number;

    /**
     * Maximum number of kilobytes per topic+partition in the local consumer queue. This value may be overshot by fetch.message.max.bytes. This property has higher priority than queued.min.messages.
     *
     * @default 1048576
     */
    "queued.max.messages.kbytes"?: number;

    /**
     * Maximum time the broker may wait to fill the response with fetch.min.bytes.
     *
     * @default 100
     */
    "fetch.wait.max.ms"?: number;

    /**
     * Initial maximum number of bytes per topic+partition to request when fetching messages from the broker. If the client encounters a message larger than this value it will gradually try to increase it until the entire message can be fetched.
     *
     * @default 1048576
     */
    "fetch.message.max.bytes"?: number;

    /**
     * Alias for `fetch.message.max.bytes`: Initial maximum number of bytes per topic+partition to request when fetching messages from the broker. If the client encounters a message larger than this value it will gradually try to increase it until the entire message can be fetched.
     *
     * @default 1048576
     */
    "max.partition.fetch.bytes"?: number;

    /**
     * Maximum amount of data the broker shall return for a Fetch request. Messages are fetched in batches by the consumer and if the first message batch in the first non-empty partition of the Fetch request is larger than this value, then the message batch will still be returned to ensure the consumer can make progress. The maximum message batch size accepted by the broker is defined via `message.max.bytes` (broker config) or `max.message.bytes` (broker topic config). `fetch.max.bytes` is automatically adjusted upwards to be at least `message.max.bytes` (consumer config).
     *
     * @default 52428800
     */
    "fetch.max.bytes"?: number;

    /**
     * Minimum number of bytes the broker responds with. If fetch.wait.max.ms expires the accumulated data will be sent to the client regardless of this setting.
     *
     * @default 1
     */
    "fetch.min.bytes"?: number;

    /**
     * How long to postpone the next fetch request for a topic+partition in case of a fetch error.
     *
     * @default 500
     */
    "fetch.error.backoff.ms"?: number;

    /**
     * **DEPRECATED** Offset commit store method: 'file' - DEPRECATED: local file store (offset.store.path, et.al), 'broker' - broker commit store (requires Apache Kafka 0.8.2 or later on the broker).
     *
     * @default broker
     */
    "offset.store.method"?: 'none' | 'file' | 'broker';

    /**
     * Controls how to read messages written transactionally: `read_committed` - only return transactional messages which have been committed. `read_uncommitted` - return all messages, even transactional messages which have been aborted.
     *
     * @default read_committed
     */
    "isolation.level"?: 'read_uncommitted' | 'read_committed';

    /**
     * Message consume callback (set with rd_kafka_conf_set_consume_cb())
     */
    "consume_cb"?: any;

    /**
     * Called after consumer group has been rebalanced (set with rd_kafka_conf_set_rebalance_cb())
     */
    "rebalance_cb"?: boolean | Function;

    /**
     * Offset commit result propagation callback. (set with rd_kafka_conf_set_offset_commit_cb())
     */
    "offset_commit_cb"?: boolean | Function;

    /**
     * Emit RD_KAFKA_RESP_ERR__PARTITION_EOF event whenever the consumer reaches the end of a partition.
     *
     * @default false
     */
    "enable.partition.eof"?: boolean;

    /**
     * Verify CRC32 of consumed messages, ensuring no on-the-wire or on-disk corruption to the messages occurred. This check comes at slightly increased CPU usage.
     *
     * @default false
     */
    "check.crcs"?: boolean;
}

export interface TopicConfig {
    /**
     * Application opaque (set with rd_kafka_topic_conf_set_opaque())
     */
    "opaque"?: any;
}

export interface ProducerTopicConfig extends TopicConfig {
    /**
     * This field indicates the number of acknowledgements the leader broker must receive from ISR brokers before responding to the request: *0*=Broker does not send any response/ack to client, *-1* or *all*=Broker will block until message is committed by all in sync replicas (ISRs). If there are less than `min.insync.replicas` (broker configuration) in the ISR set the produce request will fail.
     *
     * @default -1
     */
    "request.required.acks"?: number;

    /**
     * Alias for `request.required.acks`: This field indicates the number of acknowledgements the leader broker must receive from ISR brokers before responding to the request: *0*=Broker does not send any response/ack to client, *-1* or *all*=Broker will block until message is committed by all in sync replicas (ISRs). If there are less than `min.insync.replicas` (broker configuration) in the ISR set the produce request will fail.
     *
     * @default -1
     */
    "acks"?: number;

    /**
     * The ack timeout of the producer request in milliseconds. This value is only enforced by the broker and relies on `request.required.acks` being != 0.
     *
     * @default 5000
     */
    "request.timeout.ms"?: number;

    /**
     * Local message timeout. This value is only enforced locally and limits the time a produced message waits for successful delivery. A time of 0 is infinite. This is the maximum time librdkafka may use to deliver a message (including retries). Delivery error occurs when either the retry count or the message timeout are exceeded.
     *
     * @default 300000
     */
    "message.timeout.ms"?: number;

    /**
     * Alias for `message.timeout.ms`: Local message timeout. This value is only enforced locally and limits the time a produced message waits for successful delivery. A time of 0 is infinite. This is the maximum time librdkafka may use to deliver a message (including retries). Delivery error occurs when either the retry count or the message timeout are exceeded.
     *
     * @default 300000
     */
    "delivery.timeout.ms"?: number;

    /**
     * **EXPERIMENTAL**: subject to change or removal. **DEPRECATED** Producer queuing strategy. FIFO preserves produce ordering, while LIFO prioritizes new messages.
     *
     * @default fifo
     */
    "queuing.strategy"?: 'fifo' | 'lifo';

    /**
     * **DEPRECATED** No longer used.
     *
     * @default false
     */
    "produce.offset.report"?: boolean;

    /**
     * Partitioner: `random` - random distribution, `consistent` - CRC32 hash of key (Empty and NULL keys are mapped to single partition), `consistent_random` - CRC32 hash of key (Empty and NULL keys are randomly partitioned), `murmur2` - Java Producer compatible Murmur2 hash of key (NULL keys are mapped to single partition), `murmur2_random` - Java Producer compatible Murmur2 hash of key (NULL keys are randomly partitioned. This is functionally equivalent to the default partitioner in the Java Producer.).
     *
     * @default consistent_random
     */
    "partitioner"?: string;

    /**
     * Custom partitioner callback (set with rd_kafka_topic_conf_set_partitioner_cb())
     */
    "partitioner_cb"?: any;

    /**
     * **EXPERIMENTAL**: subject to change or removal. **DEPRECATED** Message queue ordering comparator (set with rd_kafka_topic_conf_set_msg_order_cmp()). Also see `queuing.strategy`.
     */
    "msg_order_cmp"?: any;

    /**
     * Compression codec to use for compressing message sets. inherit = inherit global compression.codec configuration.
     *
     * @default inherit
     */
    "compression.codec"?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd' | 'inherit';

    /**
     * Alias for `compression.codec`: compression codec to use for compressing message sets. This is the default value for all topics, may be overridden by the topic configuration property `compression.codec`.
     *
     * @default none
     */
    "compression.type"?: 'none' | 'gzip' | 'snappy' | 'lz4' | 'zstd';

    /**
     * Compression level parameter for algorithm selected by configuration property `compression.codec`. Higher values will result in better compression at the cost of more CPU usage. Usable range is algorithm-dependent: [0-9] for gzip; [0-12] for lz4; only 0 for snappy; -1 = codec-dependent default compression level.
     *
     * @default -1
     */
    "compression.level"?: number;
}

export interface ConsumerTopicConfig extends TopicConfig {
    /**
     * **DEPRECATED** [**LEGACY PROPERTY:** This property is used by the simple legacy consumer only. When using the high-level KafkaConsumer, the global `enable.auto.commit` property must be used instead]. If true, periodically commit offset of the last message handed to the application. This committed offset will be used when the process restarts to pick up where it left off. If false, the application will have to call `rd_kafka_offset_store()` to store an offset (optional). **NOTE:** There is currently no zookeeper integration, offsets will be written to broker or local file according to offset.store.method.
     *
     * @default true
     */
    "auto.commit.enable"?: boolean;

    /**
     * **DEPRECATED** Alias for `auto.commit.enable`: [**LEGACY PROPERTY:** This property is used by the simple legacy consumer only. When using the high-level KafkaConsumer, the global `enable.auto.commit` property must be used instead]. If true, periodically commit offset of the last message handed to the application. This committed offset will be used when the process restarts to pick up where it left off. If false, the application will have to call `rd_kafka_offset_store()` to store an offset (optional). **NOTE:** There is currently no zookeeper integration, offsets will be written to broker or local file according to offset.store.method.
     *
     * @default true
     */
    "enable.auto.commit"?: boolean;

    /**
     * [**LEGACY PROPERTY:** This setting is used by the simple legacy consumer only. When using the high-level KafkaConsumer, the global `auto.commit.interval.ms` property must be used instead]. The frequency in milliseconds that the consumer offsets are committed (written) to offset storage.
     *
     * @default 60000
     */
    "auto.commit.interval.ms"?: number;

    /**
     * Action to take when there is no initial offset in offset store or the desired offset is out of range: 'smallest','earliest' - automatically reset the offset to the smallest offset, 'largest','latest' - automatically reset the offset to the largest offset, 'error' - trigger an error which is retrieved by consuming messages and checking 'message->err'.
     *
     * @default largest
     */
    "auto.offset.reset"?: 'smallest' | 'earliest' | 'beginning' | 'largest' | 'latest' | 'end' | 'error';

    /**
     * **DEPRECATED** Path to local file for storing offsets. If the path is a directory a filename will be automatically generated in that directory based on the topic and partition. File-based offset storage will be removed in a future version.
     *
     * @default .
     */
    "offset.store.path"?: string;

    /**
     * **DEPRECATED** fsync() interval for the offset file, in milliseconds. Use -1 to disable syncing, and 0 for immediate sync after each write. File-based offset storage will be removed in a future version.
     *
     * @default -1
     */
    "offset.store.sync.interval.ms"?: number;

    /**
     * **DEPRECATED** Offset commit store method: 'file' - DEPRECATED: local file store (offset.store.path, et.al), 'broker' - broker commit store (requires "group.id" to be configured and Apache Kafka 0.8.2 or later on the broker.).
     *
     * @default broker
     */
    "offset.store.method"?: 'file' | 'broker';

    /**
     * Maximum number of messages to dispatch in one `rd_kafka_consume_callback*()` call (0 = unlimited)
     *
     * @default 0
     */
    "consume.callback.max.messages"?: number;
}