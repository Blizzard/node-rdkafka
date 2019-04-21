@echo off
choco install openssl.light
if /i %TRAVIS_NODE_VERSION% gtr 6 (
    npm install --global --production windows-build-tools
) else (
    npm install --global --production windows-build-tools@3.1.0
)

choco install make