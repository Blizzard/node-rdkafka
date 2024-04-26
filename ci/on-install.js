const fs = require('fs');
const { spawn } = require('child_process');

async function main() {
  if (fs.existsSync('./build')) {
    process.stdout.write('-- node-rdkafka bindings already installed, skipping\n');
    return;
  }

  const prebuildFileName = `platform-${process.arch}-ABI-${process.versions.modules}`;
  const prebuildFilePath = `./prebuild/${prebuildFileName}.tar.gz`;


  if (fs.existsSync(prebuildFilePath)) {
    process.stdout.write(`-- Unpacking "${prebuildFilePath}" archive...\n`);
    const tarCmd = spawn('tar', [
      'xzvf',
      `./prebuild/${prebuildFileName}.tar.gz`
    ]);
    tarCmd.stdout.pipe(process.stdout);
    tarCmd.stderr.pipe(process.stderr)
  } else {
    throw new Error(`Missing node-rdkafka for arch "${process.arch}" and ABI "${process.versions.modules}". Prebuild bindings first.`);
  }
}

main().catch(err => console.error(err));
