/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

module.exports = RefCounter;

/**
 * Ref counter class.
 *
 * Is used to basically determine active/inactive and allow callbacks that
 * hook into each.
 *
 * For the producer, it is used to begin rapid polling after a produce until
 * the delivery report is dispatched.
 */
function RefCounter(onActive, onPassive) {
  this.context = {};
  this.onActive = onActive;
  this.onPassive = onPassive;
  this.currentValue = 0;
  this.isRunning = false;
}

/**
 * Increment the ref counter
 */
RefCounter.prototype.increment = function() {
  this.currentValue += 1;

  // If current value exceeds 0, activate the start
  if (this.currentValue > 0 && !this.isRunning) {
    this.isRunning = true;
    this.onActive(this.context);
  }
};

/**
 * Decrement the ref counter
 */
RefCounter.prototype.decrement = function() {
  this.currentValue -= 1;

  if (this.currentValue <= 0 && this.isRunning) {
    this.isRunning = false;
    this.onPassive(this.context);
  }
};
