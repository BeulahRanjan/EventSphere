/**
 * Typed Domain EventEmitter for EventSphere.
 */

const EventEmitter = require('events');
const logger = require('../config/logger');

class DomainEventEmitter extends EventEmitter {
  emit(eventName, ...args) {
    logger.debug(`[DomainEvent] Emitting event: ${eventName}`, { eventName });
    return super.emit(eventName, ...args);
  }
}

const domainEventEmitter = new DomainEventEmitter();

module.exports = domainEventEmitter;
