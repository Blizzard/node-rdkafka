import { Readable, Writable } from 'stream';
import { EventEmitter } from 'events';

export class Client extends EventEmitter {
    constructor(globalConf: any, SubClientType: any, topicConf: any);

    connect(metadataOptions?: any, cb?: (err: any, data: any) => any): this;

    getClient(): any;

    connectedTime(): number;

    getLastError(): any;

    disconnect(cb?: (err: any, data: any) => any): this;
    disconnect(timeout: number, cb?: (err: any, data: any) => any): this;

    isConnected(): boolean;

    getMetadata(metadataOptions: any, cb?: (err: any, data: any) => any): any;

    queryWatermarkOffsets(topic: any, partition: any, timeout: any, cb?: (err: any, offsets: any) => any): any;

    offsetsForTimes(topicPartitions: any[], timeout: number, cb?: (err: any, offsets: any) => any): void;
    offsetsForTimes(topicPartitions: any[], cb?: (err: any, offsets: any) => any): void;
// ON
    // domain events
    on(event: 'data', listener: (arg: ConsumerStreamMessage) => void): this;
    on(event: 'rebalance', listener: (err: Error, assignment: any) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    // connectivity events
    on(event: 'end', listener: () => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'disconnected', listener: (metrics: any) => void): this;
    on(event: 'ready', listener: (info: any, metadata: any) => void): this;
    on(event: 'exit', listener: () => void): this;
    on(event: 'unsubscribed', listener: () => void): this;  // actually emitted with [] didn't see the need to add
    on(event: 'unsubscribe', listener: () => void): this;  // Backwards-compatibility, use 'unsubscribed'
    on(event: 'connection.failure', listener: (error: Error, metrics: any) => void): this;
    // event messages
    on(event: 'event.error', listener: (error: Error) => void): this;
    on(event: 'event.stats', listener: (eventData: any) => void): this;
    on(event: 'event.log', listener: (eventData: any) => void): this;
    on(event: 'event.event', listener: (eventData: any) => void): this;
    on(event: 'event.throttle', listener: (eventData: any) => void): this;
    // delivery
    on(event: 'delivery-report', listener: (error: Error, report: any) => void): this;

    // offsets
    on(event: 'offset.commit', listener: (error: Error, topicPartitions: any[]) => void): this;

// ONCE
    // domain events
    once(event: 'data', listener: (arg: ConsumerStreamMessage) => void): this;
    once(event: 'rebalance', listener: (err: Error, assignment: any) => void): this;
    once(event: 'error', listener: (err: Error) => void): this;
    // connectivity events
    once(event: 'end', listener: () => void): this;
    once(event: 'close', listener: () => void): this;
    once(event: 'disconnected', listener: (metrics: any) => void): this;
    once(event: 'ready', listener: (info: any, metadata: any) => void): this;
    once(event: 'exit', listener: () => void): this;
    once(event: 'unsubscribed', listener: () => void): this;  // actually emitted with [] didn't see the need to add
    once(event: 'unsubscribe', listener: () => void): this;  // Backwards-compatibility, use 'unsubscribed'
    once(event: 'connection.failure', listener: (error: Error, metrics: any) => void): this;
    // event messages
    once(event: 'event.error', listener: (error: Error) => void): this;
    once(event: 'event.stats', listener: (eventData: any) => void): this;
    once(event: 'event.log', listener: (eventData: any) => void): this;
    once(event: 'event.event', listener: (eventData: any) => void): this;
    once(event: 'event.throttle', listener: (eventData: any) => void): this;

    // delivery
    once(event: 'delivery-report', listener: (error: Error, report: any) => void): this;

    // offsets
    once(event: 'offset.commit', listener: (error: Error, topicPartitions: any[]) => void): this;
}

export type ErrorWrap<T> = boolean | T;

export class KafkaConsumer extends Client {
    constructor(conf: any, topicConf: any);

    assign(assignments: any): this;

    assignments(): ErrorWrap<any>;

    commit(topicPartition: any): this;
    commit(): this;

    commitMessage(msg: any): this;

    commitMessageSync(msg: any): this;

    commitSync(topicPartition: any): this;

    committed(toppars: any, timeout: any, cb: (err: any, topicPartitions: any) => void, ...args: any[]): ErrorWrap<any>;

    consume(number: number, cb?: any): void;
    consume(): void;

    getWatermarkOffsets(topic: any, partition: any): ErrorWrap<any>;

    offsetsStore(topicPartitions: any): ErrorWrap<any>;

    pause(topicPartitions: any): ErrorWrap<any>;

    position(toppars: any): ErrorWrap<any>;

    resume(topicPartitions: any): ErrorWrap<any>;

    seek(toppar: any, timeout: any, cb: any): this;

    setDefaultConsumeTimeout(timeoutMs: any): void;

    subscribe(topics: string[]): this;

    subscription(): ErrorWrap<any>;

    unassign(): this;

    unsubscribe(): this;

    createReadStream(conf: any, topicConfig: any, streamOptions: any): ConsumerStream;
}

export class Producer extends Client {
    constructor(conf: any, topicConf?: any);

    flush(timeout: any, callback: any): any;

    poll(): any;

    produce(topic: any, partition: any, message: any, key?: any, timestamp?: any, opaque?: any, headers?: any): any;

    setPollInterval(interval: any): any;

    static createWriteStream(conf: any, topicConf: any, streamOptions: any): ProducerStream;
}

export class HighLevelProducer extends Producer {
  createSerializer(serializer: Function): ({
    apply: Function | Error;
    async: boolean
  });

  produce(topic: any, partition: any, message: any, key: any, timestamp: any, callback: (err: any, offset?: number) => void): any;
  produce(topic: any, partition: any, message: any, key: any, timestamp: any, headers: any, callback: (err: any, offset?: number) => void): any;

  setKeySerializer(serializer: Function): void;
  setValueSerializer(serializer: Function): void;
}

export const CODES: {
    ERRORS: {
        ERR_BROKER_NOT_AVAILABLE: number;
        ERR_CLUSTER_AUTHORIZATION_FAILED: number;
        ERR_CONCURRENT_TRANSACTIONS: number;
        ERR_DUPLICATE_SEQUENCE_NUMBER: number;
        ERR_GROUP_AUTHORIZATION_FAILED: number;
        ERR_GROUP_COORDINATOR_NOT_AVAILABLE: number;
        ERR_GROUP_LOAD_IN_PROGRESS: number;
        ERR_ILLEGAL_GENERATION: number;
        ERR_ILLEGAL_SASL_STATE: number;
        ERR_INCONSISTENT_GROUP_PROTOCOL: number;
        ERR_INVALID_COMMIT_OFFSET_SIZE: number;
        ERR_INVALID_CONFIG: number;
        ERR_INVALID_GROUP_ID: number;
        ERR_INVALID_MSG: number;
        ERR_INVALID_MSG_SIZE: number;
        ERR_INVALID_PARTITIONS: number;
        ERR_INVALID_PRODUCER_EPOCH: number;
        ERR_INVALID_PRODUCER_ID_MAPPING: number;
        ERR_INVALID_REPLICATION_FACTOR: number;
        ERR_INVALID_REPLICA_ASSIGNMENT: number;
        ERR_INVALID_REQUEST: number;
        ERR_INVALID_REQUIRED_ACKS: number;
        ERR_INVALID_SESSION_TIMEOUT: number;
        ERR_INVALID_TIMESTAMP: number;
        ERR_INVALID_TRANSACTION_TIMEOUT: number;
        ERR_INVALID_TXN_STATE: number;
        ERR_LEADER_NOT_AVAILABLE: number;
        ERR_MSG_SIZE_TOO_LARGE: number;
        ERR_NETWORK_EXCEPTION: number;
        ERR_NOT_CONTROLLER: number;
        ERR_NOT_COORDINATOR_FOR_GROUP: number;
        ERR_NOT_ENOUGH_REPLICAS: number;
        ERR_NOT_ENOUGH_REPLICAS_AFTER_APPEND: number;
        ERR_NOT_LEADER_FOR_PARTITION: number;
        ERR_NO_ERROR: number;
        ERR_OFFSET_METADATA_TOO_LARGE: number;
        ERR_OFFSET_OUT_OF_RANGE: number;
        ERR_OPERATION_NOT_ATTEMPTED: number;
        ERR_OUT_OF_ORDER_SEQUENCE_NUMBER: number;
        ERR_POLICY_VIOLATION: number;
        ERR_REBALANCE_IN_PROGRESS: number;
        ERR_RECORD_LIST_TOO_LARGE: number;
        ERR_REPLICA_NOT_AVAILABLE: number;
        ERR_REQUEST_TIMED_OUT: number;
        ERR_SECURITY_DISABLED: number;
        ERR_STALE_CTRL_EPOCH: number;
        ERR_TOPIC_ALREADY_EXISTS: number;
        ERR_TOPIC_AUTHORIZATION_FAILED: number;
        ERR_TOPIC_EXCEPTION: number;
        ERR_TRANSACTIONAL_ID_AUTHORIZATION_FAILED: number;
        ERR_TRANSACTION_COORDINATOR_FENCED: number;
        ERR_UNKNOWN: number;
        ERR_UNKNOWN_MEMBER_ID: number;
        ERR_UNKNOWN_TOPIC_OR_PART: number;
        ERR_UNSUPPORTED_FOR_MESSAGE_FORMAT: number;
        ERR_UNSUPPORTED_SASL_MECHANISM: number;
        ERR_UNSUPPORTED_VERSION: number;
        ERR__ALL_BROKERS_DOWN: number;
        ERR__ASSIGN_PARTITIONS: number;
        ERR__AUTHENTICATION: number;
        ERR__BAD_COMPRESSION: number;
        ERR__BAD_MSG: number;
        ERR__BEGIN: number;
        ERR__CONFLICT: number;
        ERR__CRIT_SYS_RESOURCE: number;
        ERR__DESTROY: number;
        ERR__END: number;
        ERR__EXISTING_SUBSCRIPTION: number;
        ERR__FAIL: number;
        ERR__FS: number;
        ERR__INTR: number;
        ERR__INVALID_ARG: number;
        ERR__INVALID_TYPE: number;
        ERR__IN_PROGRESS: number;
        ERR__ISR_INSUFF: number;
        ERR__KEY_DESERIALIZATION: number;
        ERR__KEY_SERIALIZATION: number;
        ERR__MSG_TIMED_OUT: number;
        ERR__NODE_UPDATE: number;
        ERR__NOENT: number;
        ERR__NOT_IMPLEMENTED: number;
        ERR__NO_OFFSET: number;
        ERR__OUTDATED: number;
        ERR__PARTIAL: number;
        ERR__PARTITION_EOF: number;
        ERR__PREV_IN_PROGRESS: number;
        ERR__QUEUE_FULL: number;
        ERR__READ_ONLY: number;
        ERR__RESOLVE: number;
        ERR__REVOKE_PARTITIONS: number;
        ERR__SSL: number;
        ERR__STATE: number;
        ERR__TIMED_OUT: number;
        ERR__TIMED_OUT_QUEUE: number;
        ERR__TRANSPORT: number;
        ERR__UNDERFLOW: number;
        ERR__UNKNOWN_GROUP: number;
        ERR__UNKNOWN_PARTITION: number;
        ERR__UNKNOWN_PROTOCOL: number;
        ERR__UNKNOWN_TOPIC: number;
        ERR__UNSUPPORTED_FEATURE: number;
        ERR__VALUE_DESERIALIZATION: number;
        ERR__VALUE_SERIALIZATION: number;
        ERR__WAIT_CACHE: number;
        ERR__WAIT_COORD: number;
    };
};

export const features: string[];

export const librdkafkaVersion: string;

declare interface ProducerStream extends Writable {
    producer: Producer;
    connect(): void;
    close(cb?: Function): void;
}

declare interface ConsumerStream extends Readable {
    consumer: KafkaConsumer;
    connect(options: any): void;
    close(cb?: Function): void;
}

export type MessageKey = Buffer | string | null | undefined;

declare interface ConsumerStreamMessage {
    value: Buffer,
    size: number,
    topic: string,
    offset: number,
    partition: number,
    key?: MessageKey,
    timestamp?: number
}

export function createReadStream(conf: any, topicConf: any, streamOptions: any): ConsumerStream;

export function createWriteStream(conf: any, topicConf: any, streamOptions: any): ProducerStream;

declare interface NewTopic {
    topic: string;
    num_partitions: number;
    replication_factor: number;
    config: object
}

declare interface InternalAdminClient {
    createTopic(topic: NewTopic, cb?: (err: any, data: any) => any): void;
    createTopic(topic: NewTopic, timeout?: number, cb?: (err: any, data: any) => any): void;

    deleteTopic(topic: String, cb?: (err: any, data: any) => any): void;
    deleteTopic(topic: String, timeout?: number, cb?: (err: any, data: any) => any): void;

    createPartitions(topic: String, desiredPartitions: number, cb?: (err: any, data: any) => any): void;
    createPartitions(topic: String, desiredPartitions: number, timeout?: number, cb?: (err: any, data: any) => any): void;

    disconnect(): void;
}

export class AdminClient {
    static create(conf: object): InternalAdminClient;
}
