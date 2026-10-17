#!/usr/bin/env python3
"""Qualify the actual Dispatcher source with controlled init/send and close/send races.

Linux diagnostic: needs a C++ compiler, matching Node headers, Nan and the built
node-rdkafka package. Does not modify node_modules or run a Kafka broker. The
wrappers record unsafe calls without sending into invalid libuv memory; this
proves the binding's ordering contract, not reproduction of a historical spin.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', required=True, type=Path)
    parser.add_argument('--package-root', type=Path, default=Path(__file__).resolve().parents[3])
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--patch', type=Path)
    parser.add_argument('--expect-unsafe', action='store_true', help='negative control only')
    args = parser.parse_args()
    if sys.platform != 'linux':
        parser.error('this native linking probe currently supports Linux only')
    root = args.package_root.resolve()
    out = args.output.resolve()
    if out == root or root in out.parents:
        parser.error('output must be outside the installed dependency')
    out.mkdir(parents=True, exist_ok=True)
    (out / 'result.json').write_text(json.dumps({'passed': False, 'status': 'running'}) + '\n')
    source = out / 'src' / 'callbacks.cc'
    source.parent.mkdir(exist_ok=True)
    shutil.copyfile(root / 'src' / 'callbacks.cc', source)
    transcript = []

    def run(command, timeout=60, env=None):
        result = subprocess.run(command, cwd=out, env=env, text=True,
                                capture_output=True, timeout=timeout)
        transcript.append({'command': [str(x) for x in command],
                           'returncode': result.returncode,
                           'stdout': result.stdout, 'stderr': result.stderr})
        (out / 'commands.json').write_text(json.dumps(transcript, indent=2) + '\n')
        result.check_returncode()
        return result.stdout

    if args.patch:
        run(['patch', '-p1', '-t', '-i', str(args.patch.resolve())])
    node = args.node.resolve()
    version = run([str(node), '-p', 'process.versions.node']).strip()
    headers = next((path for path in [node.parent.parent / 'include' / 'node',
                                     Path.home() / '.cache/node-gyp' / version / 'include/node']
                    if (path / 'node.h').is_file()), None)
    if headers is None:
        raise SystemExit('Install matching Node development headers or run node-gyp configure first')
    includes = [headers, root / 'node_modules' / 'nan', root.parent / 'nan', root,
                root / 'deps' / 'librdkafka' / 'src', root / 'deps' / 'librdkafka' / 'src-cpp']
    compiler = os.environ.get('CXX', 'c++')
    base = [compiler, '-std=c++20', '-fPIC', '-pthread', '-Wno-deprecated-declarations',
            *['-I' + str(path) for path in includes]]
    run([*base, '-Duv_async_init=probe_uv_async_init', '-Duv_async_send=probe_uv_async_send',
         '-Duv_close=probe_uv_close', '-c', str(source), '-o', str(out / 'callbacks.o')])
    run([*base, '-c', str(Path(__file__).with_name('probe.cpp').resolve()),
         '-o', str(out / 'probe.o')])
    deps = root / 'build' / 'deps'
    # Bind this object's Dispatcher methods locally rather than accidentally
    # testing the prebuilt addon's implementation through ELF interposition.
    run([compiler, '-shared', '-pthread', '-Wl,-Bsymbolic', str(out / 'callbacks.o'),
         str(out / 'probe.o'), str(root / 'build' / 'Release' / 'node-librdkafka.node'),
         '-L' + str(deps), '-lrdkafka++', '-lrdkafka',
         '-Wl,-rpath,' + str(root / 'build' / 'Release') + ':' + str(deps),
         '-o', str(out / 'probe.node')])
    script = """
const p = require(process.argv[1]);
const result = {node: process.version, uv: process.versions.uv, init: [], close: []};
for (let i = 0; i < 5; i++) {
    result.init.push(p.run(false));
    result.close.push(p.run(true));
}
console.log(JSON.stringify(result));
"""
    env = dict(os.environ, LD_LIBRARY_PATH=str(deps) + ':' + os.environ.get('LD_LIBRARY_PATH', ''))
    # Deadline belongs to the parent, so even an event-loop/native deadlock is bounded.
    result = json.loads(run([str(node), '-e', script, str(out / 'probe.node')], timeout=15, env=env))
    result['source_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
    result['expect_unsafe'] = args.expect_unsafe
    result['passed'] = all(value is args.expect_unsafe
                           for phase in ('init', 'close') for value in result[phase])
    (out / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
    if not result['passed']:
        raise SystemExit('Dispatcher lifecycle ordering did not match the required contract')


if __name__ == '__main__':
    main()
