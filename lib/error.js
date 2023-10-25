/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = LibrdKafkaError;

var util = require('util');
var librdkafka = require('../librdkafka');

util.inherits(LibrdKafkaError, Error);

LibrdKafkaError.create = createLibrdkafkaError;
LibrdKafkaError.wrap = errorWrap;

/**
 * Enum for identifying errors reported by the library
 *
 * You can find this list in the C++ code at
 * https://github.com/edenhill/librdkafka/blob/master/src-cpp/rdkafkacpp.h#L148
 *
 * @readonly
 * @enum {number}
 * @constant
 */
// ====== Generated from librdkafka 2.3.0 file src-cpp/rdkafkacpp.h ======
LibrdKafkaError.codes = {

  /* Internal errors to rdkafka: */
  /** Begin internal error codes */
  ERR__BEGIN: -200,
  /** Received message is incorrect */
  ERR__BAD_MSG: -199,
  /** Bad/unknown compression */
  ERR__BAD_COMPRESSION: -198,
  /** Broker is going away */
  ERR__DESTROY: -197,
  /** Generic failure */
  ERR__FAIL: -196,
  /** Broker transport failure */
  ERR__TRANSPORT: -195,
  /** Critical system resource */
  ERR__CRIT_SYS_RESOURCE: -194,
  /** Failed to resolve broker */
  ERR__RESOLVE: -193,
  /** Produced message timed out*/
  ERR__MSG_TIMED_OUT: -192,
  /** Reached the end of the topic+partition queue on
  *  the broker. Not really an error.
  *  This event is disabled by default,
  *  see the `enable.partition.eof` configuration property. */
  ERR__PARTITION_EOF: -191,
  /** Permanent: Partition does not exist in cluster. */
  ERR__UNKNOWN_PARTITION: -190,
  /** File or filesystem error */
  ERR__FS: -189,
  /** Permanent: Topic does not exist in cluster. */
  ERR__UNKNOWN_TOPIC: -188,
  /** All broker connections are down. */
  ERR__ALL_BROKERS_DOWN: -187,
  /** Invalid argument, or invalid configuration */
  ERR__INVALID_ARG: -186,
  /** Operation timed out */
  ERR__TIMED_OUT: -185,
  /** Queue is full */
  ERR__QUEUE_FULL: -184,
  /** ISR count < required.acks */
  ERR__ISR_INSUFF: -183,
  /** Broker node update */
  ERR__NODE_UPDATE: -182,
  /** SSL error */
  ERR__SSL: -181,
  /** Waiting for coordinator to become available. */
  ERR__WAIT_COORD: -180,
  /** Unknown client group */
  ERR__UNKNOWN_GROUP: -179,
  /** Operation in progress */
  ERR__IN_PROGRESS: -178,
  /** Previous operation in progress, wait for it to finish. */
  ERR__PREV_IN_PROGRESS: -177,
  /** This operation would interfere with an existing subscription */
  ERR__EXISTING_SUBSCRIPTION: -176,
  /** Assigned partitions (rebalance_cb) */
  ERR__ASSIGN_PARTITIONS: -175,
  /** Revoked partitions (rebalance_cb) */
  ERR__REVOKE_PARTITIONS: -174,
  /** Conflicting use */
  ERR__CONFLICT: -173,
  /** Wrong state */
  ERR__STATE: -172,
  /** Unknown protocol */
  ERR__UNKNOWN_PROTOCOL: -171,
  /** Not implemented */
  ERR__NOT_IMPLEMENTED: -170,
  /** Authentication failure*/
  ERR__AUTHENTICATION: -169,
  /** No stored offset */
  ERR__NO_OFFSET: -168,
  /** Outdated */
  ERR__OUTDATED: -167,
  /** Timed out in queue */
  ERR__TIMED_OUT_QUEUE: -166,
  /** Feature not supported by broker */
  ERR__UNSUPPORTED_FEATURE: -165,
  /** Awaiting cache update */
  ERR__WAIT_CACHE: -164,
  /** Operation interrupted */
  ERR__INTR: -163,
  /** Key serialization error */
  ERR__KEY_SERIALIZATION: -162,
  /** Value serialization error */
  ERR__VALUE_SERIALIZATION: -161,
  /** Key deserialization error */
  ERR__KEY_DESERIALIZATION: -160,
  /** Value deserialization error */
  ERR__VALUE_DESERIALIZATION: -159,
  /** Partial response */
  ERR__PARTIAL: -158,
  /** Modification attempted on read-only object */
  ERR__READ_ONLY: -157,
  /** No such entry / item not found */
  ERR__NOENT: -156,
  /** Read underflow */
  ERR__UNDERFLOW: -155,
  /** Invalid type */
  ERR__INVALID_TYPE: -154,
  /** Retry operation */
  ERR__RETRY: -153,
  /** Purged in queue */
  ERR__PURGE_QUEUE: -152,
  /** Purged in flight */
  ERR__PURGE_INFLIGHT: -151,
  /** Fatal error: see RdKafka::Handle::fatal_error() */
  ERR__FATAL: -150,
  /** Inconsistent state */
  ERR__INCONSISTENT: -149,
  /** Gap-less ordering would not be guaranteed if proceeding */
  ERR__GAPLESS_GUARANTEE: -148,
  /** Maximum poll interval exceeded */
  ERR__MAX_POLL_EXCEEDED: -147,
  /** Unknown broker */
  ERR__UNKNOWN_BROKER: -146,
  /** Functionality not configured */
  ERR__NOT_CONFIGURED: -145,
  /** Instance has been fenced */
  ERR__FENCED: -144,
  /** Application generated error */
  ERR__APPLICATION: -143,
  /** Assignment lost */
  ERR__ASSIGNMENT_LOST: -142,
  /** No operation performed */
  ERR__NOOP: -141,
  /** No offset to automatically reset to */
  ERR__AUTO_OFFSET_RESET: -140,
  /** Partition log truncation detected */
  ERR__LOG_TRUNCATION: -139,
  /** End internal error codes */
  ERR__END: -100,
  /* Kafka broker errors: */
  /** Unknown broker error */
  ERR_UNKNOWN: -1,
  /** Success */
  ERR_NO_ERROR: 0,
  /** Offset out of range */
  ERR_OFFSET_OUT_OF_RANGE: 1,
  /** Invalid message */
  ERR_INVALID_MSG: 2,
  /** Unknown topic or partition */
  ERR_UNKNOWN_TOPIC_OR_PART: 3,
  /** Invalid message size */
  ERR_INVALID_MSG_SIZE: 4,
  /** Leader not available */
  ERR_LEADER_NOT_AVAILABLE: 5,
  /** Not leader for partition */
  ERR_NOT_LEADER_FOR_PARTITION: 6,
  /** Request timed out */
  ERR_REQUEST_TIMED_OUT: 7,
  /** Broker not available */
  ERR_BROKER_NOT_AVAILABLE: 8,
  /** Replica not available */
  ERR_REPLICA_NOT_AVAILABLE: 9,
  /** Message size too large */
  ERR_MSG_SIZE_TOO_LARGE: 10,
  /** StaleControllerEpochCode */
  ERR_STALE_CTRL_EPOCH: 11,
  /** Offset metadata string too large */
  ERR_OFFSET_METADATA_TOO_LARGE: 12,
  /** Broker disconnected before response received */
  ERR_NETWORK_EXCEPTION: 13,
  /** Coordinator load in progress */
  ERR_COORDINATOR_LOAD_IN_PROGRESS: 14,
/** Group coordinator load in progress */
  ERR_GROUP_LOAD_IN_PROGRESS: 14,
  /** Coordinator not available */
  ERR_COORDINATOR_NOT_AVAILABLE: 15,
/** Group coordinator not available */
  ERR_GROUP_COORDINATOR_NOT_AVAILABLE: 15,
  /** Not coordinator */
  ERR_NOT_COORDINATOR: 16,
/** Not coordinator for group */
  ERR_NOT_COORDINATOR_FOR_GROUP: 16,
  /** Invalid topic */
  ERR_TOPIC_EXCEPTION: 17,
  /** Message batch larger than configured server segment size */
  ERR_RECORD_LIST_TOO_LARGE: 18,
  /** Not enough in-sync replicas */
  ERR_NOT_ENOUGH_REPLICAS: 19,
  /** Message(s) written to insufficient number of in-sync replicas */
  ERR_NOT_ENOUGH_REPLICAS_AFTER_APPEND: 20,
  /** Invalid required acks value */
  ERR_INVALID_REQUIRED_ACKS: 21,
  /** Specified group generation id is not valid */
  ERR_ILLEGAL_GENERATION: 22,
  /** Inconsistent group protocol */
  ERR_INCONSISTENT_GROUP_PROTOCOL: 23,
  /** Invalid group.id */
  ERR_INVALID_GROUP_ID: 24,
  /** Unknown member */
  ERR_UNKNOWN_MEMBER_ID: 25,
  /** Invalid session timeout */
  ERR_INVALID_SESSION_TIMEOUT: 26,
  /** Group rebalance in progress */
  ERR_REBALANCE_IN_PROGRESS: 27,
  /** Commit offset data size is not valid */
  ERR_INVALID_COMMIT_OFFSET_SIZE: 28,
  /** Topic authorization failed */
  ERR_TOPIC_AUTHORIZATION_FAILED: 29,
  /** Group authorization failed */
  ERR_GROUP_AUTHORIZATION_FAILED: 30,
  /** Cluster authorization failed */
  ERR_CLUSTER_AUTHORIZATION_FAILED: 31,
  /** Invalid timestamp */
  ERR_INVALID_TIMESTAMP: 32,
  /** Unsupported SASL mechanism */
  ERR_UNSUPPORTED_SASL_MECHANISM: 33,
  /** Illegal SASL state */
  ERR_ILLEGAL_SASL_STATE: 34,
  /** Unuspported version */
  ERR_UNSUPPORTED_VERSION: 35,
  /** Topic already exists */
  ERR_TOPIC_ALREADY_EXISTS: 36,
  /** Invalid number of partitions */
  ERR_INVALID_PARTITIONS: 37,
  /** Invalid replication factor */
  ERR_INVALID_REPLICATION_FACTOR: 38,
  /** Invalid replica assignment */
  ERR_INVALID_REPLICA_ASSIGNMENT: 39,
  /** Invalid config */
  ERR_INVALID_CONFIG: 40,
  /** Not controller for cluster */
  ERR_NOT_CONTROLLER: 41,
  /** Invalid request */
  ERR_INVALID_REQUEST: 42,
  /** Message format on broker does not support request */
  ERR_UNSUPPORTED_FOR_MESSAGE_FORMAT: 43,
  /** Policy violation */
  ERR_POLICY_VIOLATION: 44,
  /** Broker received an out of order sequence number */
  ERR_OUT_OF_ORDER_SEQUENCE_NUMBER: 45,
  /** Broker received a duplicate sequence number */
  ERR_DUPLICATE_SEQUENCE_NUMBER: 46,
  /** Producer attempted an operation with an old epoch */
  ERR_INVALID_PRODUCER_EPOCH: 47,
  /** Producer attempted a transactional operation in an invalid state */
  ERR_INVALID_TXN_STATE: 48,
  /** Producer attempted to use a producer id which is not
  *  currently assigned to its transactional id */
  ERR_INVALID_PRODUCER_ID_MAPPING: 49,
  /** Transaction timeout is larger than the maximum
  *  value allowed by the broker's max.transaction.timeout.ms */
  ERR_INVALID_TRANSACTION_TIMEOUT: 50,
  /** Producer attempted to update a transaction while another
  *  concurrent operation on the same transaction was ongoing */
  ERR_CONCURRENT_TRANSACTIONS: 51,
  /** Indicates that the transaction coordinator sending a
  *  WriteTxnMarker is no longer the current coordinator for a
  *  given producer */
  ERR_TRANSACTION_COORDINATOR_FENCED: 52,
  /** Transactional Id authorization failed */
  ERR_TRANSACTIONAL_ID_AUTHORIZATION_FAILED: 53,
  /** Security features are disabled */
  ERR_SECURITY_DISABLED: 54,
  /** Operation not attempted */
  ERR_OPERATION_NOT_ATTEMPTED: 55,
  /** Disk error when trying to access log file on the disk */
  ERR_KAFKA_STORAGE_ERROR: 56,
  /** The user-specified log directory is not found in the broker config */
  ERR_LOG_DIR_NOT_FOUND: 57,
  /** SASL Authentication failed */
  ERR_SASL_AUTHENTICATION_FAILED: 58,
  /** Unknown Producer Id */
  ERR_UNKNOWN_PRODUCER_ID: 59,
  /** Partition reassignment is in progress */
  ERR_REASSIGNMENT_IN_PROGRESS: 60,
  /** Delegation Token feature is not enabled */
  ERR_DELEGATION_TOKEN_AUTH_DISABLED: 61,
  /** Delegation Token is not found on server */
  ERR_DELEGATION_TOKEN_NOT_FOUND: 62,
  /** Specified Principal is not valid Owner/Renewer */
  ERR_DELEGATION_TOKEN_OWNER_MISMATCH: 63,
  /** Delegation Token requests are not allowed on this connection */
  ERR_DELEGATION_TOKEN_REQUEST_NOT_ALLOWED: 64,
  /** Delegation Token authorization failed */
  ERR_DELEGATION_TOKEN_AUTHORIZATION_FAILED: 65,
  /** Delegation Token is expired */
  ERR_DELEGATION_TOKEN_EXPIRED: 66,
  /** Supplied principalType is not supported */
  ERR_INVALID_PRINCIPAL_TYPE: 67,
  /** The group is not empty */
  ERR_NON_EMPTY_GROUP: 68,
  /** The group id does not exist */
  ERR_GROUP_ID_NOT_FOUND: 69,
  /** The fetch session ID was not found */
  ERR_FETCH_SESSION_ID_NOT_FOUND: 70,
  /** The fetch session epoch is invalid */
  ERR_INVALID_FETCH_SESSION_EPOCH: 71,
  /** No matching listener */
  ERR_LISTENER_NOT_FOUND: 72,
  /** Topic deletion is disabled */
  ERR_TOPIC_DELETION_DISABLED: 73,
  /** Leader epoch is older than broker epoch */
  ERR_FENCED_LEADER_EPOCH: 74,
  /** Leader epoch is newer than broker epoch */
  ERR_UNKNOWN_LEADER_EPOCH: 75,
  /** Unsupported compression type */
  ERR_UNSUPPORTED_COMPRESSION_TYPE: 76,
  /** Broker epoch has changed */
  ERR_STALE_BROKER_EPOCH: 77,
  /** Leader high watermark is not caught up */
  ERR_OFFSET_NOT_AVAILABLE: 78,
  /** Group member needs a valid member ID */
  ERR_MEMBER_ID_REQUIRED: 79,
  /** Preferred leader was not available */
  ERR_PREFERRED_LEADER_NOT_AVAILABLE: 80,
  /** Consumer group has reached maximum size */
  ERR_GROUP_MAX_SIZE_REACHED: 81,
  /** Static consumer fenced by other consumer with same
  * group.instance.id. */
  ERR_FENCED_INSTANCE_ID: 82,
  /** Eligible partition leaders are not available */
  ERR_ELIGIBLE_LEADERS_NOT_AVAILABLE: 83,
  /** Leader election not needed for topic partition */
  ERR_ELECTION_NOT_NEEDED: 84,
  /** No partition reassignment is in progress */
  ERR_NO_REASSIGNMENT_IN_PROGRESS: 85,
  /** Deleting offsets of a topic while the consumer group is
  *  subscribed to it */
  ERR_GROUP_SUBSCRIBED_TO_TOPIC: 86,
  /** Broker failed to validate record */
  ERR_INVALID_RECORD: 87,
  /** There are unstable offsets that need to be cleared */
  ERR_UNSTABLE_OFFSET_COMMIT: 88,
  /** Throttling quota has been exceeded */
  ERR_THROTTLING_QUOTA_EXCEEDED: 89,
  /** There is a newer producer with the same transactionalId
  *  which fences the current one */
  ERR_PRODUCER_FENCED: 90,
  /** Request illegally referred to resource that does not exist */
  ERR_RESOURCE_NOT_FOUND: 91,
  /** Request illegally referred to the same resource twice */
  ERR_DUPLICATE_RESOURCE: 92,
  /** Requested credential would not meet criteria for acceptability */
  ERR_UNACCEPTABLE_CREDENTIAL: 93,
  /** Indicates that the either the sender or recipient of a
  *  voter-only request is not one of the expected voters */
  ERR_INCONSISTENT_VOTER_SET: 94,
  /** Invalid update version */
  ERR_INVALID_UPDATE_VERSION: 95,
  /** Unable to update finalized features due to server error */
  ERR_FEATURE_UPDATE_FAILED: 96,
  /** Request principal deserialization failed during forwarding */
  ERR_PRINCIPAL_DESERIALIZATION_FAILURE: 97
};

/**
 * Representation of a librdkafka error
 *
 * This can be created by giving either another error
 * to piggy-back on. In this situation it tries to parse
 * the error string to figure out the intent. However, more usually,
 * it is constructed by an error object created by a C++ Baton.
 *
 * @param {object|error} e - An object or error to wrap
 * @property {string} message - The error message
 * @property {number} code - The error code.
 * @property {string} origin - The origin, whether it is local or remote
 * @constructor
 */
function LibrdKafkaError(e) {
  if (!(this instanceof LibrdKafkaError)) {
    return new LibrdKafkaError(e);
  }

  if (typeof e === 'number') {
    this.message = librdkafka.err2str(e);
    this.code = e;
    this.errno = e;
    if (e >= LibrdKafkaError.codes.ERR__END) {
      this.origin = 'local';
    } else {
      this.origin = 'kafka';
    }
    Error.captureStackTrace(this, this.constructor);
  } else if (!util.isError(e)) {
    // This is the better way
    this.message = e.message;
    this.code = e.code;
    this.errno = e.code;
    if (e.code >= LibrdKafkaError.codes.ERR__END) {
      this.origin = 'local';
    } else {
      this.origin = 'kafka';
    }
    Error.captureStackTrace(this, this.constructor);
  } else {
    var message = e.message;
    var parsedMessage = message.split(': ');

    var origin, msg;

    if (parsedMessage.length > 1) {
      origin = parsedMessage[0].toLowerCase();
      msg = parsedMessage[1].toLowerCase();
    } else {
      origin = 'unknown';
      msg = message.toLowerCase();
    }

    // special cases
    if (msg === 'consumer is disconnected' || msg === 'producer is disconnected') {
      this.origin = 'local';
      this.code = LibrdKafkaError.codes.ERR__STATE;
      this.errno = this.code;
      this.message = msg;
    } else {
      this.origin = origin;
      this.message = msg;
      this.code = typeof e.code === 'number' ? e.code : -1;
      this.errno = this.code;
      this.stack = e.stack;
    }

  }

  if (e.hasOwnProperty('isFatal')) this.isFatal = e.isFatal;
  if (e.hasOwnProperty('isRetriable')) this.isRetriable = e.isRetriable;
  if (e.hasOwnProperty('isTxnRequiresAbort')) this.isTxnRequiresAbort = e.isTxnRequiresAbort;

}

function createLibrdkafkaError(e) {
  return new LibrdKafkaError(e);
}

function errorWrap(errorCode, intIsError) {
  var returnValue = true;
  if (intIsError) {
    returnValue = errorCode;
    errorCode = typeof errorCode === 'number' ? errorCode : 0;
  }

  if (errorCode !== LibrdKafkaError.codes.ERR_NO_ERROR) {
    var e = LibrdKafkaError.create(errorCode);
    throw e;
  }

  return returnValue;
}
