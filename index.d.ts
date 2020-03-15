import { Readable, Writable } from 'stream';
import { EventEmitter } from 'events';
import {
    GlobalConfig,
    TopicConfig,
    ConsumerGlobalConfig,
    ConsumerTopicConfig,
    ProducerGlobalConfig,
    ProducerTopicConfig,
} from './config';

export * from './config';
export * from './errors';

export class Client extends EventEmitter {
    constructor(globalConf: GlobalConfig, SubClientType: any, topicConf: TopicConfig);

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
    constructor(conf: ConsumerGlobalConfig, topicConf: ConsumerTopicConfig);

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

    static createReadStream(conf: ConsumerGlobalConfig, topicConfig: ConsumerTopicConfig, streamOptions: any): ConsumerStream;
}

export class Producer extends Client {
    constructor(conf: ProducerGlobalConfig, topicConf?: ProducerTopicConfig);

    flush(timeout: any, callback: any): any;

    poll(): any;

    produce(topic: any, partition: any, message: any, key?: any, timestamp?: any, opaque?: any, headers?: any): any;

    setPollInterval(interval: any): any;

    static createWriteStream(conf: ProducerGlobalConfig, topicConf: ProducerTopicConfig, streamOptions: any): ProducerStream;
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

export function createReadStream(conf: ConsumerGlobalConfig, topicConf: ConsumerTopicConfig, streamOptions: any): ConsumerStream;

export function createWriteStream(conf: ProducerGlobalConfig, topicConf: ProducerTopicConfig, streamOptions: any): ProducerStream;

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
    static create(conf: GlobalConfig): InternalAdminClient;
}
