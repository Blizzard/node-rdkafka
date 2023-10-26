// ====== Generated from librdkafka 2.3.0 file src-cpp/rdkafkacpp.h ======
export const CODES: { ERRORS: {
  /* Internal errors to rdkafka: */
  /** Begin internal error codes (**-200**) */
  ERR__BEGIN: number,
  /** Received message is incorrect (**-199**) */
  ERR__BAD_MSG: number,
  /** Bad/unknown compression (**-198**) */
  ERR__BAD_COMPRESSION: number,
  /** Broker is going away (**-197**) */
  ERR__DESTROY: number,
  /** Generic failure (**-196**) */
  ERR__FAIL: number,
  /** Broker transport failure (**-195**) */
  ERR__TRANSPORT: number,
  /** Critical system resource (**-194**) */
  ERR__CRIT_SYS_RESOURCE: number,
  /** Failed to resolve broker (**-193**) */
  ERR__RESOLVE: number,
  /** Produced message timed out (**-192**) */
  ERR__MSG_TIMED_OUT: number,
  /** Reached the end of the topic+partition queue on
  *  the broker. Not really an error.
  *  This event is disabled by default,
  *  see the `enable.partition.eof` configuration property (**-191**) */
  ERR__PARTITION_EOF: number,
  /** Permanent: Partition does not exist in cluster (**-190**) */
  ERR__UNKNOWN_PARTITION: number,
  /** File or filesystem error (**-189**) */
  ERR__FS: number,
  /** Permanent: Topic does not exist in cluster (**-188**) */
  ERR__UNKNOWN_TOPIC: number,
  /** All broker connections are down (**-187**) */
  ERR__ALL_BROKERS_DOWN: number,
  /** Invalid argument, or invalid configuration (**-186**) */
  ERR__INVALID_ARG: number,
  /** Operation timed out (**-185**) */
  ERR__TIMED_OUT: number,
  /** Queue is full (**-184**) */
  ERR__QUEUE_FULL: number,
  /** ISR count < required.acks (**-183**) */
  ERR__ISR_INSUFF: number,
  /** Broker node update (**-182**) */
  ERR__NODE_UPDATE: number,
  /** SSL error (**-181**) */
  ERR__SSL: number,
  /** Waiting for coordinator to become available (**-180**) */
  ERR__WAIT_COORD: number,
  /** Unknown client group (**-179**) */
  ERR__UNKNOWN_GROUP: number,
  /** Operation in progress (**-178**) */
  ERR__IN_PROGRESS: number,
  /** Previous operation in progress, wait for it to finish (**-177**) */
  ERR__PREV_IN_PROGRESS: number,
  /** This operation would interfere with an existing subscription (**-176**) */
  ERR__EXISTING_SUBSCRIPTION: number,
  /** Assigned partitions (rebalance_cb) (**-175**) */
  ERR__ASSIGN_PARTITIONS: number,
  /** Revoked partitions (rebalance_cb) (**-174**) */
  ERR__REVOKE_PARTITIONS: number,
  /** Conflicting use (**-173**) */
  ERR__CONFLICT: number,
  /** Wrong state (**-172**) */
  ERR__STATE: number,
  /** Unknown protocol (**-171**) */
  ERR__UNKNOWN_PROTOCOL: number,
  /** Not implemented (**-170**) */
  ERR__NOT_IMPLEMENTED: number,
  /** Authentication failure (**-169**) */
  ERR__AUTHENTICATION: number,
  /** No stored offset (**-168**) */
  ERR__NO_OFFSET: number,
  /** Outdated (**-167**) */
  ERR__OUTDATED: number,
  /** Timed out in queue (**-166**) */
  ERR__TIMED_OUT_QUEUE: number,
  /** Feature not supported by broker (**-165**) */
  ERR__UNSUPPORTED_FEATURE: number,
  /** Awaiting cache update (**-164**) */
  ERR__WAIT_CACHE: number,
  /** Operation interrupted (**-163**) */
  ERR__INTR: number,
  /** Key serialization error (**-162**) */
  ERR__KEY_SERIALIZATION: number,
  /** Value serialization error (**-161**) */
  ERR__VALUE_SERIALIZATION: number,
  /** Key deserialization error (**-160**) */
  ERR__KEY_DESERIALIZATION: number,
  /** Value deserialization error (**-159**) */
  ERR__VALUE_DESERIALIZATION: number,
  /** Partial response (**-158**) */
  ERR__PARTIAL: number,
  /** Modification attempted on read-only object (**-157**) */
  ERR__READ_ONLY: number,
  /** No such entry / item not found (**-156**) */
  ERR__NOENT: number,
  /** Read underflow (**-155**) */
  ERR__UNDERFLOW: number,
  /** Invalid type (**-154**) */
  ERR__INVALID_TYPE: number,
  /** Retry operation (**-153**) */
  ERR__RETRY: number,
  /** Purged in queue (**-152**) */
  ERR__PURGE_QUEUE: number,
  /** Purged in flight (**-151**) */
  ERR__PURGE_INFLIGHT: number,
  /** Fatal error: see RdKafka::Handle::fatal_error() (**-150**) */
  ERR__FATAL: number,
  /** Inconsistent state (**-149**) */
  ERR__INCONSISTENT: number,
  /** Gap-less ordering would not be guaranteed if proceeding (**-148**) */
  ERR__GAPLESS_GUARANTEE: number,
  /** Maximum poll interval exceeded (**-147**) */
  ERR__MAX_POLL_EXCEEDED: number,
  /** Unknown broker (**-146**) */
  ERR__UNKNOWN_BROKER: number,
  /** Functionality not configured (**-145**) */
  ERR__NOT_CONFIGURED: number,
  /** Instance has been fenced (**-144**) */
  ERR__FENCED: number,
  /** Application generated error (**-143**) */
  ERR__APPLICATION: number,
  /** Assignment lost (**-142**) */
  ERR__ASSIGNMENT_LOST: number,
  /** No operation performed (**-141**) */
  ERR__NOOP: number,
  /** No offset to automatically reset to (**-140**) */
  ERR__AUTO_OFFSET_RESET: number,
  /** Partition log truncation detected (**-139**) */
  ERR__LOG_TRUNCATION: number,
  /** End internal error codes (**-100**) */
  ERR__END: number,
  /* Kafka broker errors: */
  /** Unknown broker error (**-1**) */
  ERR_UNKNOWN: number,
  /** Success (**0**) */
  ERR_NO_ERROR: number,
  /** Offset out of range (**1**) */
  ERR_OFFSET_OUT_OF_RANGE: number,
  /** Invalid message (**2**) */
  ERR_INVALID_MSG: number,
  /** Unknown topic or partition (**3**) */
  ERR_UNKNOWN_TOPIC_OR_PART: number,
  /** Invalid message size (**4**) */
  ERR_INVALID_MSG_SIZE: number,
  /** Leader not available (**5**) */
  ERR_LEADER_NOT_AVAILABLE: number,
  /** Not leader for partition (**6**) */
  ERR_NOT_LEADER_FOR_PARTITION: number,
  /** Request timed out (**7**) */
  ERR_REQUEST_TIMED_OUT: number,
  /** Broker not available (**8**) */
  ERR_BROKER_NOT_AVAILABLE: number,
  /** Replica not available (**9**) */
  ERR_REPLICA_NOT_AVAILABLE: number,
  /** Message size too large (**10**) */
  ERR_MSG_SIZE_TOO_LARGE: number,
  /** StaleControllerEpochCode (**11**) */
  ERR_STALE_CTRL_EPOCH: number,
  /** Offset metadata string too large (**12**) */
  ERR_OFFSET_METADATA_TOO_LARGE: number,
  /** Broker disconnected before response received (**13**) */
  ERR_NETWORK_EXCEPTION: number,
  /** Coordinator load in progress (**14**) */
  ERR_COORDINATOR_LOAD_IN_PROGRESS: number,
/** Group coordinator load in progress (**14**) */
  ERR_GROUP_LOAD_IN_PROGRESS: number,
  /** Coordinator not available (**15**) */
  ERR_COORDINATOR_NOT_AVAILABLE: number,
/** Group coordinator not available (**15**) */
  ERR_GROUP_COORDINATOR_NOT_AVAILABLE: number,
  /** Not coordinator (**16**) */
  ERR_NOT_COORDINATOR: number,
/** Not coordinator for group (**16**) */
  ERR_NOT_COORDINATOR_FOR_GROUP: number,
  /** Invalid topic (**17**) */
  ERR_TOPIC_EXCEPTION: number,
  /** Message batch larger than configured server segment size (**18**) */
  ERR_RECORD_LIST_TOO_LARGE: number,
  /** Not enough in-sync replicas (**19**) */
  ERR_NOT_ENOUGH_REPLICAS: number,
  /** Message(s) written to insufficient number of in-sync replicas (**20**) */
  ERR_NOT_ENOUGH_REPLICAS_AFTER_APPEND: number,
  /** Invalid required acks value (**21**) */
  ERR_INVALID_REQUIRED_ACKS: number,
  /** Specified group generation id is not valid (**22**) */
  ERR_ILLEGAL_GENERATION: number,
  /** Inconsistent group protocol (**23**) */
  ERR_INCONSISTENT_GROUP_PROTOCOL: number,
  /** Invalid group.id (**24**) */
  ERR_INVALID_GROUP_ID: number,
  /** Unknown member (**25**) */
  ERR_UNKNOWN_MEMBER_ID: number,
  /** Invalid session timeout (**26**) */
  ERR_INVALID_SESSION_TIMEOUT: number,
  /** Group rebalance in progress (**27**) */
  ERR_REBALANCE_IN_PROGRESS: number,
  /** Commit offset data size is not valid (**28**) */
  ERR_INVALID_COMMIT_OFFSET_SIZE: number,
  /** Topic authorization failed (**29**) */
  ERR_TOPIC_AUTHORIZATION_FAILED: number,
  /** Group authorization failed (**30**) */
  ERR_GROUP_AUTHORIZATION_FAILED: number,
  /** Cluster authorization failed (**31**) */
  ERR_CLUSTER_AUTHORIZATION_FAILED: number,
  /** Invalid timestamp (**32**) */
  ERR_INVALID_TIMESTAMP: number,
  /** Unsupported SASL mechanism (**33**) */
  ERR_UNSUPPORTED_SASL_MECHANISM: number,
  /** Illegal SASL state (**34**) */
  ERR_ILLEGAL_SASL_STATE: number,
  /** Unuspported version (**35**) */
  ERR_UNSUPPORTED_VERSION: number,
  /** Topic already exists (**36**) */
  ERR_TOPIC_ALREADY_EXISTS: number,
  /** Invalid number of partitions (**37**) */
  ERR_INVALID_PARTITIONS: number,
  /** Invalid replication factor (**38**) */
  ERR_INVALID_REPLICATION_FACTOR: number,
  /** Invalid replica assignment (**39**) */
  ERR_INVALID_REPLICA_ASSIGNMENT: number,
  /** Invalid config (**40**) */
  ERR_INVALID_CONFIG: number,
  /** Not controller for cluster (**41**) */
  ERR_NOT_CONTROLLER: number,
  /** Invalid request (**42**) */
  ERR_INVALID_REQUEST: number,
  /** Message format on broker does not support request (**43**) */
  ERR_UNSUPPORTED_FOR_MESSAGE_FORMAT: number,
  /** Policy violation (**44**) */
  ERR_POLICY_VIOLATION: number,
  /** Broker received an out of order sequence number (**45**) */
  ERR_OUT_OF_ORDER_SEQUENCE_NUMBER: number,
  /** Broker received a duplicate sequence number (**46**) */
  ERR_DUPLICATE_SEQUENCE_NUMBER: number,
  /** Producer attempted an operation with an old epoch (**47**) */
  ERR_INVALID_PRODUCER_EPOCH: number,
  /** Producer attempted a transactional operation in an invalid state (**48**) */
  ERR_INVALID_TXN_STATE: number,
  /** Producer attempted to use a producer id which is not
  *  currently assigned to its transactional id (**49**) */
  ERR_INVALID_PRODUCER_ID_MAPPING: number,
  /** Transaction timeout is larger than the maximum
  *  value allowed by the broker's max.transaction.timeout.ms (**50**) */
  ERR_INVALID_TRANSACTION_TIMEOUT: number,
  /** Producer attempted to update a transaction while another
  *  concurrent operation on the same transaction was ongoing (**51**) */
  ERR_CONCURRENT_TRANSACTIONS: number,
  /** Indicates that the transaction coordinator sending a
  *  WriteTxnMarker is no longer the current coordinator for a
  *  given producer (**52**) */
  ERR_TRANSACTION_COORDINATOR_FENCED: number,
  /** Transactional Id authorization failed (**53**) */
  ERR_TRANSACTIONAL_ID_AUTHORIZATION_FAILED: number,
  /** Security features are disabled (**54**) */
  ERR_SECURITY_DISABLED: number,
  /** Operation not attempted (**55**) */
  ERR_OPERATION_NOT_ATTEMPTED: number,
  /** Disk error when trying to access log file on the disk (**56**) */
  ERR_KAFKA_STORAGE_ERROR: number,
  /** The user-specified log directory is not found in the broker config (**57**) */
  ERR_LOG_DIR_NOT_FOUND: number,
  /** SASL Authentication failed (**58**) */
  ERR_SASL_AUTHENTICATION_FAILED: number,
  /** Unknown Producer Id (**59**) */
  ERR_UNKNOWN_PRODUCER_ID: number,
  /** Partition reassignment is in progress (**60**) */
  ERR_REASSIGNMENT_IN_PROGRESS: number,
  /** Delegation Token feature is not enabled (**61**) */
  ERR_DELEGATION_TOKEN_AUTH_DISABLED: number,
  /** Delegation Token is not found on server (**62**) */
  ERR_DELEGATION_TOKEN_NOT_FOUND: number,
  /** Specified Principal is not valid Owner/Renewer (**63**) */
  ERR_DELEGATION_TOKEN_OWNER_MISMATCH: number,
  /** Delegation Token requests are not allowed on this connection (**64**) */
  ERR_DELEGATION_TOKEN_REQUEST_NOT_ALLOWED: number,
  /** Delegation Token authorization failed (**65**) */
  ERR_DELEGATION_TOKEN_AUTHORIZATION_FAILED: number,
  /** Delegation Token is expired (**66**) */
  ERR_DELEGATION_TOKEN_EXPIRED: number,
  /** Supplied principalType is not supported (**67**) */
  ERR_INVALID_PRINCIPAL_TYPE: number,
  /** The group is not empty (**68**) */
  ERR_NON_EMPTY_GROUP: number,
  /** The group id does not exist (**69**) */
  ERR_GROUP_ID_NOT_FOUND: number,
  /** The fetch session ID was not found (**70**) */
  ERR_FETCH_SESSION_ID_NOT_FOUND: number,
  /** The fetch session epoch is invalid (**71**) */
  ERR_INVALID_FETCH_SESSION_EPOCH: number,
  /** No matching listener (**72**) */
  ERR_LISTENER_NOT_FOUND: number,
  /** Topic deletion is disabled (**73**) */
  ERR_TOPIC_DELETION_DISABLED: number,
  /** Leader epoch is older than broker epoch (**74**) */
  ERR_FENCED_LEADER_EPOCH: number,
  /** Leader epoch is newer than broker epoch (**75**) */
  ERR_UNKNOWN_LEADER_EPOCH: number,
  /** Unsupported compression type (**76**) */
  ERR_UNSUPPORTED_COMPRESSION_TYPE: number,
  /** Broker epoch has changed (**77**) */
  ERR_STALE_BROKER_EPOCH: number,
  /** Leader high watermark is not caught up (**78**) */
  ERR_OFFSET_NOT_AVAILABLE: number,
  /** Group member needs a valid member ID (**79**) */
  ERR_MEMBER_ID_REQUIRED: number,
  /** Preferred leader was not available (**80**) */
  ERR_PREFERRED_LEADER_NOT_AVAILABLE: number,
  /** Consumer group has reached maximum size (**81**) */
  ERR_GROUP_MAX_SIZE_REACHED: number,
  /** Static consumer fenced by other consumer with same
  * group.instance.id (**82**) */
  ERR_FENCED_INSTANCE_ID: number,
  /** Eligible partition leaders are not available (**83**) */
  ERR_ELIGIBLE_LEADERS_NOT_AVAILABLE: number,
  /** Leader election not needed for topic partition (**84**) */
  ERR_ELECTION_NOT_NEEDED: number,
  /** No partition reassignment is in progress (**85**) */
  ERR_NO_REASSIGNMENT_IN_PROGRESS: number,
  /** Deleting offsets of a topic while the consumer group is
  *  subscribed to it (**86**) */
  ERR_GROUP_SUBSCRIBED_TO_TOPIC: number,
  /** Broker failed to validate record (**87**) */
  ERR_INVALID_RECORD: number,
  /** There are unstable offsets that need to be cleared (**88**) */
  ERR_UNSTABLE_OFFSET_COMMIT: number,
  /** Throttling quota has been exceeded (**89**) */
  ERR_THROTTLING_QUOTA_EXCEEDED: number,
  /** There is a newer producer with the same transactionalId
  *  which fences the current one (**90**) */
  ERR_PRODUCER_FENCED: number,
  /** Request illegally referred to resource that does not exist (**91**) */
  ERR_RESOURCE_NOT_FOUND: number,
  /** Request illegally referred to the same resource twice (**92**) */
  ERR_DUPLICATE_RESOURCE: number,
  /** Requested credential would not meet criteria for acceptability (**93**) */
  ERR_UNACCEPTABLE_CREDENTIAL: number,
  /** Indicates that the either the sender or recipient of a
  *  voter-only request is not one of the expected voters (**94**) */
  ERR_INCONSISTENT_VOTER_SET: number,
  /** Invalid update version (**95**) */
  ERR_INVALID_UPDATE_VERSION: number,
  /** Unable to update finalized features due to server error (**96**) */
  ERR_FEATURE_UPDATE_FAILED: number,
  /** Request principal deserialization failed during forwarding (**97**) */
  ERR_PRINCIPAL_DESERIALIZATION_FAILURE: number,
}}