NODE-GYP ?= node_modules/.bin/node-gyp
PYTHON ?= python
NODE ?= node
CPPLINT ?= cpplint.py
BUILDTYPE ?= Release
TESTS = "test/**/*.js"
E2E_TESTS = $(wildcard e2e/*.spec.js)
TEST_REPORTER =
TEST_OUTPUT =
CONFIG_OUTPUTS = \
  build/bindings.target.mk \
  build/Makefile \
  build/binding.Makefile build/config.gypi

CPPLINT_FILES = $(wildcard src/*.cc src/*.h)
CPPLINT_FILTER = -legal/copyright
JSLINT_FILES = $(wildcard lib/**/*.js test/**/*.js)

PACKAGE = $(shell node -pe 'require("./package.json").name.split("/")[1]')
VERSION = $(shell node -pe 'require("./package.json").version')

GYPBUILDARGS=
ifeq ($(BUILDTYPE),Debug)
GYPBUILDARGS=--debug
endif

.PHONY: all clean lint test lib docs e2e ghpages

all: lint lib test e2e

lint: cpplint jslint

cpplint:
	@$(PYTHON) $(CPPLINT) --filter=$(CPPLINT_FILTER) $(CPPLINT_FILES)

jslint: node_modules/.dirstamp
	@./node_modules/.bin/jshint $(JSLINT_FILES)

lib: node_modules/.dirstamp $(CONFIG_OUTPUTS)
	@$(NODE-GYP) build $(GYPBUILDARGS)

node_modules/.dirstamp: package.json
	@npm update --loglevel warn
	@touch $@

$(CONFIG_OUTPUTS): node_modules/.dirstamp binding.gyp
	@$(NODE-GYP) configure

test: node_modules/.dirstamp
	@./node_modules/.bin/mocha $(TEST_REPORTER) $(TESTS) $(TEST_OUTPUT)

e2e: $(E2E_TESTS)
	@$(NODE) e2e/consumer.spec.js && $(NODE) e2e/producer.spec.js && $(NODE) e2e/both.spec.js


define release
	NEXT_VERSION=$(shell node -pe 'require("semver").inc("$(VERSION)", "$(1)")')
	node -e "\
	  var j = require('./package.json');\
	  j.version = \"$$NEXT_VERSION\";\
	  var s = JSON.stringify(j, null, 2);\
	  require('fs').writeFileSync('./package.json', s);" && \
	git commit -m "release $$NEXT_VERSION" -- package.json && \
	git tag "$$NEXT_VERSION" -m "release $$NEXT_VERSION"
endef

docs: node_modules/.dirstamp
	@rm -rf docs
	@./node_modules/jsdoc/jsdoc.js --destination docs \
		--recurse -R ./README.md \
		-t "./node_modules/toolkit-jsdoc/" \
		--tutorials examples ./lib

gh-pages: node_modules/.dirstamp
	@./make_docs.sh

release-patch:
	@$(call release,patch)

clean: node_modules/.dirstamp
	@rm -f deps/librdkafka/config.h
	@$(NODE-GYP) clean
