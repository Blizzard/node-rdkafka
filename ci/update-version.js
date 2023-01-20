const path = require('path');
const semver = require('semver');
const { spawn } = require('child_process');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const pjsPath = path.resolve(root, 'package.json');
const pjs = require(pjsPath);

function parseVersion(tag) {
  const { major, minor, prerelease, patch } = semver.parse(tag);

  // Describe will give is commits since last tag
  const [commitsSinceTag, hash] = prerelease[0] ? prerelease[0].split('-') : [
    1,
    process.env.TRAVIS_COMMIT || ''
  ];

  return {
    major,
    minor,
    prerelease,
    patch,
    commit: commitsSinceTag - 1,
    hash
  };
}

function getCommandOutput(command, args, cb) {
  let output = '';

  const cmd = spawn(command, args);

  cmd.stdout.on('data', (data) => {
    output += data;
  });

  cmd.on('close', (code) => {
    if (code != 0) {
      cb(new Error(`Command returned unsuccessful code: ${code}`));
      return;
    }

    cb(null, output.trim());
  });
}

function getVersion(cb) {
  // https://docs.travis-ci.com/user/environment-variables/
  if (process.env.TRAVIS_TAG) {
    setImmediate(() => cb(null, parseVersion(process.env.TRAVIS_TAG.trim())));
    return;
  }

  getCommandOutput('git', ['describe', '--tags'], (err, result) => {
    if (err) {
      cb(err);
      return;
    }

    cb(null, parseVersion(result.trim()));
  });
}

function getBranch(cb) {
  if (process.env.TRAVIS_TAG) {
    // TRAVIS_BRANCH matches TRAVIS_TAG when TRAVIS_TAG is set
    // "git branch --contains tags/TRAVIS_TAG" doesn't work on travis so we have to assume 'master'
    setImmediate(() => cb(null, 'master'));
    return;
  } else if (process.env.TRAVIS_BRANCH) {
    setImmediate(() => cb(null, process.env.TRAVIS_BRANCH.trim()));
    return;
  }

  getCommandOutput('git', ['rev-parse', '--abbrev-ref', 'HEAD'], (err, result) => {
    if (err) {
      cb(err);
      return;
    }

    cb(null, result.trim());
  });
}

function getPackageVersion(tag, branch) {
  const baseVersion = `v${tag.major}.${tag.minor}.${tag.patch}`;

  console.log(`Package version is "${baseVersion}"`);

  // never publish with an suffix
  // fixes https://github.com/Blizzard/node-rdkafka/issues/981
  // baseVersion += '-';

  // if (tag.commit === 0 && branch === 'master') {
  //   return baseVersion;
  // }

  // if (branch !== 'master') {
  //   baseVersion += (tag.commit + 1 + '.' + branch);
  // } else {
  //   baseVersion += (tag.commit + 1);
  // }

  return baseVersion;
}

getVersion((err, tag) => {
  if (err) {
    throw err;
  }

  getBranch((err, branch) => {
    if (err) {
      throw err;
    }

    pjs.version = getPackageVersion(tag, branch);

    fs.writeFileSync(pjsPath, JSON.stringify(pjs, null, 2));
  })

});
