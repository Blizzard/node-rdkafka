import { Readable, Writable } from 'stream';

export class Client extends NodeJS.EventEmitter {
    constructor(globalConf: any, SubClientType: any, topicConf: any);

    connect(metadataOptions?: any, cb?: (err: any, data: any) => any): this;

    getClient(): any;

    connectedTime(): number;

    getLastError(): any;

    disconnect(cb?: (err: any, data: any) => any): this;
    isConnected(): boolean;

    getMetadata(metadataOptions: any, cb?: (err: any, data: any) => any): any;

    queryWatermarkOffsets(topic: any, partition: any, timeout: any, cb?: (err: any, offsets: any) => any): any;

    offsetsForTimes(topicPartitions: any[], timeout: number, cb?: (err: any, offsets: any) => any): void;
    offsetsForTimes(topicPartitions: any[], cb?: (err: any, offsets: any) => any): void;

    // currently need to overload signature for different callback arities because of https://github.com/Microsoft/TypeScript/issues/15972
    on<T extends keyof EventCallbackRepositoryArityOne, K extends EventCallbackRepositoryArityOne[T]>(val: T, listener: (arg: K) => void): this;
    on<T extends keyof EventCallbackRepositoryArityTwo, K extends EventCallbackRepositoryArityTwo[T]>(val: T, listener: (arg0: K[0], arg1: K[1]) => void): this;
    once<T extends keyof EventCallbackRepositoryArityOne, K extends EventCallbackRepositoryArityOne[T]>(val: T, listener: (arg: K) => void): this;
    once<T extends keyof EventCallbackRepositoryArityTwo, K extends EventCallbackRepositoryArityTwo[T]>(val: T, listener: (arg0: K[0], arg1: K[1]) => void): this;
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

}

export class Producer extends Client {
    constructor(conf: any, topicConf: any);

    flush(timeout: any, callback: any): any;

    poll(): any;

    produce(topic: any, partition: any, message: any, key?: any, timestamp?: any, opaque?: any): any;

    setPollInterval(interval: any): any;

}

export const CODES: {
    ERRORS: {
        ERR_BROKER_NOT_AVAILABLE: number;
        ERR_CLUSTER_AUTHORIZATION_FAILED: number;
        ERR_GROUP_AUTHORIZATION_FAILED: number;
        ERR_GROUP_COORDINATOR_NOT_AVAILABLE: number;
        ERR_GROUP_LOAD_IN_PROGRESS: number;
        ERR_ILLEGAL_GENERATION: number;
        ERR_INCONSISTENT_GROUP_PROTOCOL: number;
        ERR_INVALID_COMMIT_OFFSET_SIZE: number;
        ERR_INVALID_GROUP_ID: number;
        ERR_INVALID_MSG: number;
        ERR_INVALID_MSG_SIZE: number;
        ERR_INVALID_REQUIRED_ACKS: number;
        ERR_INVALID_SESSION_TIMEOUT: number;
        ERR_LEADER_NOT_AVAILABLE: number;
        ERR_MSG_SIZE_TOO_LARGE: number;
        ERR_NETWORK_EXCEPTION: number;
        ERR_NOT_COORDINATOR_FOR_GROUP: number;
        ERR_NOT_ENOUGH_REPLICAS: number;
        ERR_NOT_ENOUGH_REPLICAS_AFTER_APPEND: number;
        ERR_NOT_LEADER_FOR_PARTITION: number;
        ERR_NO_ERROR: number;
        ERR_OFFSET_METADATA_TOO_LARGE: number;
        ERR_OFFSET_OUT_OF_RANGE: number;
        ERR_REBALANCE_IN_PROGRESS: number;
        ERR_RECORD_LIST_TOO_LARGE: number;
        ERR_REPLICA_NOT_AVAILABLE: number;
        ERR_REQUEST_TIMED_OUT: number;
        ERR_STALE_CTRL_EPOCH: number;
        ERR_TOPIC_AUTHORIZATION_FAILED: number;
        ERR_TOPIC_EXCEPTION: number;
        ERR_UNKNOWN: number;
        ERR_UNKNOWN_MEMBER_ID: number;
        ERR_UNKNOWN_TOPIC_OR_PART: number;
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
        ERR__INVALID_ARG: number;
        ERR__IN_PROGRESS: number;
        ERR__ISR_INSUFF: number;
        ERR__MSG_TIMED_OUT: number;
        ERR__NODE_UPDATE: number;
        ERR__NOT_IMPLEMENTED: number;
        ERR__NO_OFFSET: number;
        ERR__OUTDATED: number;
        ERR__PARTITION_EOF: number;
        ERR__PREV_IN_PROGRESS: number;
        ERR__QUEUE_FULL: number;
        ERR__RESOLVE: number;
        ERR__REVOKE_PARTITIONS: number;
        ERR__SSL: number;
        ERR__STATE: number;
        ERR__TIMED_OUT: number;
        ERR__TIMED_OUT_QUEUE: number;
        ERR__TRANSPORT: number;
        ERR__UNKNOWN_GROUP: number;
        ERR__UNKNOWN_PARTITION: number;
        ERR__UNKNOWN_PROTOCOL: number;
        ERR__UNKNOWN_TOPIC: number;
        ERR__UNSUPPORTED_FEATURE: number;
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

declare interface ConsumerStreamMessage {
  value: Buffer,
  size: number,
  topic: string,
  offset: number,
  partition: number,
  key?: string,
  timestamp?: number
}

export function createReadStream(conf: any, topicConf: any, streamOptions: any): ConsumerStream;

export function createWriteStream(conf: any, topicConf: any, streamOptions: any): ProducerStream;

declare interface EventCallbackRepositoryArityOne {
  // domain events
  'data': ConsumerStreamMessage,
  'rebalance': any,
  'error': any,

  // connectity events
  'end': any,
  'close': any,
  'disconnected': any,
  'ready': any,
  'exit': any,
  'unsubscribed': any,'connection.failure': any,

  // event messages
  'event.error': any,
  'event.log': any,
  'event.throttle': any,
  'event.event': any,
}

declare interface EventCallbackRepositoryArityTwo {
  'delivery-report': [any, any]
}
