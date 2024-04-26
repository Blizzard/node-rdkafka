const fs = require('fs');

async function main() {
  if (fs.existsSync('./build')) {
    console.log('node-rdkafka bindings already installed, skipping');
    return;
  }

  const prebuildDirectory = `./prebuild/platform-${process.arch}/ABI-${process.versions.modules}/build`;

  if (fs.existsSync(prebuildDirectory)) {
    await fs.promises.rename(prebuildDirectory, './build');
  } else {
    throw new Error(`Mispsing node-rdkafka for arch "${process.arch}" and ABI "${process.versions.modules}". Prebuild bindings first.`);
  }
}

main().catch(err => console.error(err));
