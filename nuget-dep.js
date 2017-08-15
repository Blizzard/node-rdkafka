const fs = require('fs');
const download = require('download');
const decompress = require('decompress');
const path = require('path');
const os = require('os');
const process = require('process');

const filename = 'librdkafka.redist.zip';
const downloadDestFolder = path.join('.', 'deps');
const extractDestFolder = path.join('.', 'deps', 'win32-runtime');
const extensions = [ '.lib', '.dll' ];

if(os.type() == 'Windows_NT') {
	
	var architecture = process.arch.includes('64') ? 'x64' : 'x86';
	
	download('https://www.nuget.org/api/v2/package/librdkafka.redist/', downloadDestFolder, { filename: filename })
	.then(() => {
		console.log('librdkafka.redist downloaded.');
		decompress(path.join('.', downloadDestFolder, filename), '.', {
			filter: file => file.path.includes(architecture) && extensions.includes(path.extname(file.path)),
			map: file => {
				file.path = path.join(extractDestFolder, path.basename(file.path));
				return file;
			}
		})
		.then(files => console.log('librdkafka.redist extracted.'));
	})
}
