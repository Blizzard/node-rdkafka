// Exercise the installed node-rdkafka Dispatcher, not a copied implementation.
// Compile callbacks.cc separately with uv_async_init/send/close redirected to
// these wrappers. The probe itself must use the real libuv entry points.
#include "src/callbacks.h"

#include <thread>

namespace {
/** Owns the bounded interleaving between the loop thread and one native sender. */
struct Probe {
    /** Protects the probe's phase and observations; independent of Dispatcher. */
    uv_mutex_t lock;
    /** Wakes the sender when initialization or close reaches the wrapped call. */
    uv_cond_t condition;
    /** Selects the close window instead of the initialization window. */
    bool close_mode;
    /** Indicates the selected lifecycle call has entered its controlled window. */
    bool window = false;
    /** Records that the sender is about to call the real Dispatcher::Execute. */
    bool attempted = false;
    /** Records a send while the handle is initializing or closing. */
    bool invalid_send = false;

    /** Initializes synchronization before the worker can observe this instance. */
    explicit Probe(bool close) : close_mode(close) {
        uv_mutex_init(&lock);
        uv_cond_init(&condition);
    }
    /** Releases synchronization after the sender has joined. */
    ~Probe() {
        uv_cond_destroy(&condition);
        uv_mutex_destroy(&lock);
    }

    /** Exposes the lifecycle window until the sender attempts Execute, then
     * briefly allows an unguarded sender to enter. The process owner enforces
     * a deadline independently if a broken implementation never reaches here. */
    void expose_window() {
        uv_mutex_lock(&lock);
        window = true;
        uv_cond_broadcast(&condition);
        while (!attempted)
            uv_cond_wait(&condition, &lock);
        const uint64_t deadline = uv_hrtime() + 300000000;
        while (!invalid_send && uv_hrtime() < deadline) {
            const uint64_t now = uv_hrtime();
            if (now >= deadline)
                break;
            uv_cond_timedwait(&condition, &lock, deadline - now);
        }
        uv_mutex_unlock(&lock);
    }
    /** Ends the observation window before a synchronized Execute can proceed. */
    void end_window() {
        uv_mutex_lock(&lock);
        window = false;
        uv_mutex_unlock(&lock);
    }
};
/** Borrows the current call's stack-owned state until its sender is joined. */
Probe* active = nullptr;

/** Uses the dependency's real lifecycle implementation without event payloads. */
class Dispatcher final : public NodeKafka::Callbacks::Dispatcher {
    /** No events are enqueued by this lifecycle-only probe. */
    void Flush() override {}
};
} // namespace

/** Widens initialization before touching libuv so early publication is observable. */
extern "C" int probe_uv_async_init(uv_loop_t* loop, uv_async_t* handle, uv_async_cb callback) {
    if (!active->close_mode)
        active->expose_window();
    const int result = uv_async_init(loop, handle, callback);
    if (!active->close_mode)
        active->end_window();
    return result;
}

/** Records forbidden sends, forwarding only calls outside the lifecycle window. */
extern "C" int probe_uv_async_send(uv_async_t* handle) {
    uv_mutex_lock(&active->lock);
    const bool invalid = active->window;
    active->invalid_send |= invalid;
    uv_cond_broadcast(&active->condition);
    uv_mutex_unlock(&active->lock);
    // The negative control must report the illegal call without touching an
    // uninitialized/closing libuv handle or intentionally hanging the process.
    return invalid ? 0 : uv_async_send(handle);
}

/** Widens close while the concurrent sender tries to acquire its handle. */
extern "C" void probe_uv_close(uv_handle_t* handle, uv_close_cb callback) {
    if (active->close_mode)
        active->expose_window();
    uv_close(handle, callback);
    if (active->close_mode)
        active->end_window();
}

/** Returns whether the real Dispatcher sent inside the selected unsafe window.
 * The Node caller owns the process deadline; the sender is joined before return. */
NAN_METHOD(Run) {
    Probe probe(info.Length() > 0 && Nan::To<bool>(info[0]).FromMaybe(false));
    active = &probe;
    Dispatcher dispatcher;
    if (probe.close_mode)
        dispatcher.Activate();
    std::thread sender([&] {
        uv_mutex_lock(&probe.lock);
        while (!probe.window)
            uv_cond_wait(&probe.condition, &probe.lock);
        probe.attempted = true;
        uv_cond_broadcast(&probe.condition);
        uv_mutex_unlock(&probe.lock);
        dispatcher.Execute();
    });
    if (probe.close_mode)
        dispatcher.Deactivate();
    else
        dispatcher.Activate();
    sender.join();
    if (!probe.close_mode)
        dispatcher.Deactivate();
    active = nullptr;
    info.GetReturnValue().Set(Nan::New(probe.invalid_send));
}

/** Exposes the bounded lifecycle probe to its owning Node subprocess. */
NAN_MODULE_INIT(Initialize) { Nan::SetMethod(target, "run", Run); }
NODE_MODULE(dispatcher_probe, Initialize)
