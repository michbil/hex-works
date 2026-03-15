const { TextEncoder, TextDecoder } = require('util');

// jsdom doesn't provide TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// jsdom doesn't provide structuredClone (needed by fake-indexeddb)
if (typeof global.structuredClone === 'undefined') {
  const { MessageChannel } = require('worker_threads');
  global.structuredClone = (value) => {
    const { port1, port2 } = new MessageChannel();
    port1.unref();
    port2.unref();
    // For simple values, use a synchronous deep-copy fallback
    // structuredClone handles Uint8Array, ArrayBuffer, etc.
    try {
      // Use v8 serialize/deserialize for full structured clone support
      const v8 = require('v8');
      return v8.deserialize(v8.serialize(value));
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  };
}
