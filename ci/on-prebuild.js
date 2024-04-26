const fs = require('fs');
const { spawn } = require('child_process');

async function main() {
  const prebuildFileName = `platform-${process.arch}-ABI-${process.versions.modules}`;

  process.stdout.write(`Preparing "./prebuild/${prebuildFileName}.tar.gz" archive...\n`);
  const tarCmd = spawn('tar', [
    'czvf',
    `./prebuild/${prebuildFileName}.tar.gz`,
    './build',
  ]);
  tarCmd.stdout.pipe(process.stdout);
  tarCmd.stderr.pipe(process.stderr)
}

main().catch(err => console.error(err));
