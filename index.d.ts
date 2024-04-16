import { Readable, ReadableOptions, Writable, WritableOptions } from 'stream';
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

export interface LibrdKafkaError {
    message: string;
    code: number;
    errno: number;
    origin: string;
    stack?: string;
    isFatal?: boolean;
    isRetriable?: boolean;
    isTxnRequiresAbort?: boolean;
}

export interface ReadyInfo {
    name: string;
}

export interface ClientMetrics {
    connectionOpened: number;
}

export interface MetadataOptions {
    topic?: string;
    allTopics?: boolean;
    timeout?: number;
}

export interface BrokerMetadata {
    id: number;
    host: string;
    port: number;
}

export interface PartitionMetadata {
    id: number;
    leader: number;
    replicas: number[];
    isrs: number[];
}

export interface TopicMetadata {
    name: string;
    partitions: PartitionMetadata[];
}

export interface Metadata {
    orig_broker_id: number;
    orig_broker_name: string;
    topics: TopicMetadata[];
    brokers: BrokerMetadata[];
}

export interface WatermarkOffsets{
    lowOffset: number;
    highOffset: number;
}

export interface TopicPartition {
    topic: string;
    partition: number;
}

export interface TopicPartitionOffset extends TopicPartition{
    offset: number;
}

export type TopicPartitionTime = TopicPartitionOffset;

export type EofEvent = TopicPartitionOffset;

export type Assignment = TopicPartition | TopicPartitionOffset;

export interface DeliveryReport extends TopicPartitionOffset {
    value?: MessageValue;
    size: number;
    key?: MessageKey;
    timestamp?: number;
    opaque?: any;
}

export type NumberNullUndefined = number | null | undefined;

export type MessageKey = Buffer | string | null | undefined;
export type MessageHeader = { [key: string]: string | Buffer };
export type MessageValue = Buffer | null;
export type SubscribeTopic = string | RegExp;
export type SubscribeTopicList = SubscribeTopic[];

export interface Message extends TopicPartitionOffset {
    value: MessageValue;
    size: number;
    topic: string;
    key?: MessageKey;
    timestamp?: number;
    headers?: MessageHeader[];
    opaque?: any;
}

export interface ReadStreamOptions extends ReadableOptions {
    topics: SubscribeTopicList | SubscribeTopic | ((metadata: Metadata) => SubscribeTopicList);
    waitInterval?: number;
    fetchSize?: number;
    objectMode?: boolean;
    highWaterMark?: number;
    autoClose?: boolean;
    streamAsBatch?: boolean;
    connectOptions?: any;
    initOauthBearerToken?: string;
}

export interface WriteStreamOptions extends WritableOptions {
    encoding?: string;
    objectMode?: boolean;
    topic?: string;
    autoClose?: boolean;
    pollInterval?: number;
    connectOptions?: any;
}

export interface ProducerStream extends Writable {
    producer: Producer;
    connect(metadataOptions?: MetadataOptions): void;
    close(cb?: () => void): void;
}

export interface ConsumerStream extends Readable {
    consumer: KafkaConsumer;
    connect(options: ConsumerGlobalConfig): void;
    refreshOauthBearerToken(tokenStr: string): void;
    close(cb?: () => void): void;
}

type KafkaClientEvents = 'disconnected' | 'ready' | 'connection.failure' | 'event.error' | 'event.stats' | 'event.log' | 'event.event' | 'event.throttle';
type KafkaConsumerEvents = 'data' | 'partition.eof' | 'rebalance' | 'rebalance.error' | 'subscribed' | 'unsubscribed' | 'unsubscribe' | 'offset.commit' | KafkaClientEvents;
type KafkaProducerEvents = 'delivery-report' | KafkaClientEvents;

type EventListenerMap = {
    // ### Client
    // connectivity events
    'disconnected': (metrics: ClientMetrics) => void,
    'ready': (info: ReadyInfo, metadata: Metadata) => void,
    'connection.failure': (error: LibrdKafkaError, metrics: ClientMetrics) => void,
    // event messages
    'event.error': (error: LibrdKafkaError) => void,
    'event.stats': (eventData: any) => void,
    'event.log': (eventData: any) => void,
    'event.event': (eventData: any) => void,
    'event.throttle': (eventData: any) => void,
    // ### Consumer only
    // domain events
    'data': (arg: Message) => void,
    'partition.eof': (arg: EofEvent) => void,
    'rebalance': (err: LibrdKafkaError, assignments: TopicPartition[]) => void,
    'rebalance.error': (err: Error) => void,
    // connectivity events
    'subscribed': (topics: SubscribeTopicList) => void,
    'unsubscribe': () => void,
    'unsubscribed': () => void,
    // offsets
    'offset.commit': (error: LibrdKafkaError, topicPartitions: TopicPartitionOffset[]) => void,
    // ### Producer only
    // delivery
    'delivery-report': (error: LibrdKafkaError, report: DeliveryReport) => void,
}

type EventListener<K extends string> = K extends keyof EventListenerMap ? EventListenerMap[K] : never;

export abstract class Client<Events extends string> extends EventEmitter {
    constructor(globalConf: GlobalConfig, SubClientType: any, topicConf: TopicConfig);

    connect(metadataOptions?: MetadataOptions, cb?: (err: LibrdKafkaError, data: Metadata) => any): this;

    setOauthBearerToken(tokenStr: string): this;

    getClient(): any;

    connectedTime(): number;

    getLastError(): LibrdKafkaError;

    disconnect(cb?: (err: any, data: ClientMetrics) => any): this;
    disconnect(timeout: number, cb?: (err: any, data: ClientMetrics) => any): this;

    isConnected(): boolean;

    getMetadata(metadataOptions?: MetadataOptions, cb?: (err: LibrdKafkaError, data: Metadata) => any): any;

    queryWatermarkOffsets(topic: string, partition: number, timeout: number, cb?: (err: LibrdKafkaError, offsets: WatermarkOffsets) => any): any;
    queryWatermarkOffsets(topic: string, partition: number, cb?: (err: LibrdKafkaError, offsets: WatermarkOffsets) => any): any;

    on<E extends Events>(event: E, listener: EventListener<E>): this;
    once<E extends Events>(event: E, listener: EventListener<E>): this;
}

export class KafkaConsumer extends Client<KafkaConsumerEvents> {
    constructor(conf: ConsumerGlobalConfig, topicConf: ConsumerTopicConfig);

    assign(assignments: Assignment[]): this;

    assignments(): Assignment[];

    commit(topicPartition: TopicPartitionOffset | TopicPartitionOffset[]): this;
    commit(): this;

    commitMessage(msg: TopicPartitionOffset): this;

    commitMessageSync(msg: TopicPartitionOffset): this;

    commitSync(topicPartition: TopicPartitionOffset | TopicPartitionOffset[]): this;

    committed(toppars: TopicPartition[], timeout: number, cb: (err: LibrdKafkaError, topicPartitions: TopicPartitionOffset[]) => void): this;
    committed(timeout: number, cb: (err: LibrdKafkaError, topicPartitions: TopicPartitionOffset[]) => void): this;

    consume(number: number, cb?: (err: LibrdKafkaError, messages: Message[]) => void): void;
    consume(cb: (err: LibrdKafkaError, messages: Message[]) => void): void;
    consume(): void;

    getWatermarkOffsets(topic: string, partition: number): WatermarkOffsets;

    offsetsStore(topicPartitions: TopicPartitionOffset[]): any;

    pause(topicPartitions: TopicPartition[]): any;

    position(toppars?: TopicPartition[]): TopicPartitionOffset[];

    resume(topicPartitions: TopicPartition[]): any;

    seek(toppar: TopicPartitionOffset, timeout: number | null, cb: (err: LibrdKafkaError) => void): this;

    setDefaultConsumeTimeout(timeoutMs: number): void;

    setDefaultConsumeLoopTimeoutDelay(timeoutMs: number): void;

    subscribe(topics: SubscribeTopicList): this;

    subscription(): string[];

    unassign(): this;

    unsubscribe(): this;

    offsetsForTimes(topicPartitions: TopicPartitionTime[], timeout: number, cb?: (err: LibrdKafkaError, offsets: TopicPartitionOffset[]) => any): void;
    offsetsForTimes(topicPartitions: TopicPartitionTime[], cb?: (err: LibrdKafkaError, offsets: TopicPartitionOffset[]) => any): void;

    static createReadStream(conf: ConsumerGlobalConfig, topicConfig: ConsumerTopicConfig, streamOptions: ReadStreamOptions | number): ConsumerStream;
}

export class Producer extends Client<KafkaProducerEvents> {
    constructor(conf: ProducerGlobalConfig, topicConf?: ProducerTopicConfig);

    flush(timeout?: NumberNullUndefined, cb?: (err: LibrdKafkaError) => void): this;

    poll(): this;

    produce(topic: string, partition: NumberNullUndefined, message: MessageValue, key?: MessageKey, timestamp?: NumberNullUndefined, opaque?: any, headers?: MessageHeader[]): any;

    setPollInterval(interval: number): this;

    static createWriteStream(conf: ProducerGlobalConfig, topicConf: ProducerTopicConfig, streamOptions: WriteStreamOptions): ProducerStream;

    initTransactions(cb: (err: LibrdKafkaError) => void): void;
    initTransactions(timeout: number, cb: (err: LibrdKafkaError) => void): void;
    beginTransaction(cb: (err: LibrdKafkaError) => void): void;
    commitTransaction(cb: (err: LibrdKafkaError) => void): void;
    commitTransaction(timeout: number, cb: (err: LibrdKafkaError) => void): void;
    abortTransaction(cb: (err: LibrdKafkaError) => void): void;
    abortTransaction(timeout: number, cb: (err: LibrdKafkaError) => void): void;
    sendOffsetsToTransaction(offsets: TopicPartitionOffset[], consumer: KafkaConsumer, cb: (err: LibrdKafkaError) => void): void;
    sendOffsetsToTransaction(offsets: TopicPartitionOffset[], consumer: KafkaConsumer, timeout: number, cb: (err: LibrdKafkaError) => void): void;
}

export class HighLevelProducer extends Producer {
  produce(topic: string, partition: NumberNullUndefined, message: any, key: any, timestamp: NumberNullUndefined, callback: (err: any, offset?: NumberNullUndefined) => void): any;
  produce(topic: string, partition: NumberNullUndefined, message: any, key: any, timestamp: NumberNullUndefined, headers: MessageHeader[], callback: (err: any, offset?: NumberNullUndefined) => void): any;

  setKeySerializer(serializer: (key: any, cb: (err: any, key: MessageKey) => void) => void): void;
  setKeySerializer(serializer: (key: any) => MessageKey | Promise<MessageKey>): void;
  setValueSerializer(serializer: (value: any, cb: (err: any, value: MessageValue) => void) => void): void;
  setValueSerializer(serializer: (value: any) => MessageValue | Promise<MessageValue>): void;
}

export const features: string[];

export const librdkafkaVersion: string;

export function createReadStream(conf: ConsumerGlobalConfig, topicConf: ConsumerTopicConfig, streamOptions: ReadStreamOptions | number): ConsumerStream;

export function createWriteStream(conf: ProducerGlobalConfig, topicConf: ProducerTopicConfig, streamOptions: WriteStreamOptions): ProducerStream;

export interface NewTopic {
    topic: string;
    num_partitions: number;
    replication_factor: number;
    config?: {
        'cleanup.policy'?: 'delete' | 'compact' | 'delete,compact' | 'compact,delete';
        'compression.type'?: 'gzip' | 'snappy' | 'lz4' | 'zstd' | 'uncompressed' | 'producer';
        'delete.retention.ms'?: string;
        'file.delete.delay.ms'?: string;
        'flush.messages'?: string;
        'flush.ms'?: string;
        'follower.replication.throttled.replicas'?: string;
        'index.interval.bytes'?: string;
        'leader.replication.throttled.replicas'?: string;
        'max.compaction.lag.ms'?: string;
        'max.message.bytes'?: string;
        'message.format.version'?: string;
        'message.timestamp.difference.max.ms'?: string;
        'message.timestamp.type'?: string;
        'min.cleanable.dirty.ratio'?: string;
        'min.compaction.lag.ms'?: string;
        'min.insync.replicas'?: string;
        'preallocate'?: string;
        'retention.bytes'?: string;
        'retention.ms'?: string;
        'segment.bytes'?: string;
        'segment.index.bytes'?: string;
        'segment.jitter.ms'?: string;
        'segment.ms'?: string;
        'unclean.leader.election.enable'?: string;
        'message.downconversion.enable'?: string;
    } | { [cfg: string]: string; };
}

export interface IAdminClient {
    refreshOauthBearerToken(tokenStr: string): void;

    createTopic(topic: NewTopic, cb?: (err: LibrdKafkaError) => void): void;
    createTopic(topic: NewTopic, timeout?: number, cb?: (err: LibrdKafkaError) => void): void;

    deleteTopic(topic: string, cb?: (err: LibrdKafkaError) => void): void;
    deleteTopic(topic: string, timeout?: number, cb?: (err: LibrdKafkaError) => void): void;

    createPartitions(topic: string, desiredPartitions: number, cb?: (err: LibrdKafkaError) => void): void;
    createPartitions(topic: string, desiredPartitions: number, timeout?: number, cb?: (err: LibrdKafkaError) => void): void;

    disconnect(): void;
}

export abstract class AdminClient {
    static create(conf: GlobalConfig, initOauthBearerToken?: string): IAdminClient;
}
