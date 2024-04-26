const fs = require('fs');

async function main() {
  const prebuildDirectory = `./prebuild/platform-${process.arch}/ABI-${process.versions.modules}/build`;
  await fs.promises.mkdir(prebuildDirectory, { recursive: true });


  await fs.promises.rename('./build', prebuildDirectory);

}

main().catch(err => console.error(err));
