When using docker to install `node-rdkafka`, you need to make sure you install appropriate library dependencies. Alpine linux is a lighter weight version of linux and does not come with the same base libraries as other distributions (like glibc).

You can see some of the differences here: https://linuxacademy.com/blog/cloud/alpine-linux-and-docker/

```dockerfile
FROM node:8-alpine

RUN apk --no-cache add \
      bash \
      g++ \
      ca-certificates \
      lz4-dev \
      musl-dev \
      cyrus-sasl-dev \
      openssl-dev \
      make \
      python

RUN apk add --no-cache --virtual .build-deps gcc zlib-dev libc-dev bsd-compat-headers py-setuptools bash

# Create app directory
RUN mkdir -p /usr/local/app

# Move to the app directory
WORKDIR /usr/local/app

# Install node-rdkafka
RUN npm install node-rdkafka
# Copy package.json first to check if an npm install is needed
```
