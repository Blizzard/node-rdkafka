#ifndef SRC_KAFKA_OPERATION_RESULT_H_
#define SRC_KAFKA_OPERATION_RESULT_H_

#include <cassert>
#include <memory>
#include <string>

#include "rdkafkacpp.h"

namespace NodeKafka {
/**
 * Type-safe wrapper for the result of an RDKafka library operation.
 */
template<typename T>
class KafkaOperationResult {
  public:
    /**
     * Constructor for a successful operation result.
     * Takes ownership of the data pointer.
     */
    explicit KafkaOperationResult(T* data)
      : m_data(data), m_err(RdKafka::ErrorCode::ERR_NO_ERROR) {}
    explicit KafkaOperationResult(RdKafka::ErrorCode err)
      : m_data(nullptr), m_err(err) {}
    explicit KafkaOperationResult(RdKafka::ErrorCode err, std::string errstr)
      : m_data(nullptr), m_err(err), m_errstr(errstr) {}

    /**
     * Get a non-owning pointer to the result data.
     * Only should be called for non-error results.
     */
    T* data() const {
      assert(m_data != nullptr);
      return m_data.get();
    }

    /**
     * Transfer ownership of the result data to the caller.
     * Only should be called for non-error results.
     */
    std::unique_ptr<T> take_ownership() {
      assert(m_data != nullptr);
      std::unique_ptr<T> data = std::move(m_data);
      m_data.reset();
      return data;
    }

    RdKafka::ErrorCode err() const {
      return m_err;
    }

    std::string errstr() const {
      return m_errstr.empty() ? RdKafka::err2str(m_err) : m_errstr;
    }

  private:
    std::unique_ptr<T> m_data;
    RdKafka::ErrorCode m_err;
    std::string m_errstr;
};
} // namespace NodeKafka

#endif  // SRC_KAFKA_OPERATION_RESULT_H_
