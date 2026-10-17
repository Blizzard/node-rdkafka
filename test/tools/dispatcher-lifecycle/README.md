# Dispatcher lifecycle regression (Linux)

The Mocha unit suite runs this regression on Linux. Build the addon and install
its dependencies normally. To run it separately from the project root:

```sh
python3 test/tools/dispatcher-lifecycle/probe.py \
  --node "$(command -v node)" --output /tmp/node-rdkafka-dispatcher
```

This compiles the real `src/callbacks.cc`, redirecting only `uv_async_init`,
`uv_async_send` and `uv_close` in that object. A native sender tries to execute
while initialization or close is deliberately held open. Sends inside either
window fail qualification. The original source fails all ten checks; use
`--expect-unsafe` only when verifying that negative control. `--patch` can apply
a candidate patch to the private source copy without modifying the checkout.

The probe records and suppresses unsafe sends instead of accessing invalid
libuv memory. It proves the dispatcher's synchronization contract, not a
reproduction of every possible downstream hang. A parent-enforced 15-second
process deadline bounds a broken implementation even if Node's loop is stuck.
No Kafka server is needed. Native linking currently uses Linux ELF symbol
binding so that the tested object cannot accidentally call the installed
addon's Dispatcher methods. The production fix itself is portable.

Matching Node headers are found beside its `bin` directory or in the standard
`~/.cache/node-gyp/<version>/include/node` cache.
