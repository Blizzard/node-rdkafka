@echo off
choco install openssl.light
REM if /i %TRAVIS_NODE_VERSION% gtr 6 (
REM     npm install --global --production windows-build-tools
REM ) else (
REM     npm install --global --production windows-build-tools@3.1.0
REM )

choco install make