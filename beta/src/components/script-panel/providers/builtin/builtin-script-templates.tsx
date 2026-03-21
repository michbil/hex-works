
export const DEFAULT_NEW_UI_SCRIPT = `<template>
  <div class="hex-ui-script">
    <h3>{{ title }}</h3>
    <button @click="analyze">Analyze Buffer</button>
    <pre>{{ output }}</pre>
  </div>
</template>

<script>
export default {
  data() {
    return {
      title: 'Buffer Analyzer',
      output: 'Click Analyze to inspect the buffer.',
    };
  },
  methods: {
    analyze() {
      const len = this.$buffer.length;
      const count = Math.min(16, len);
      const bytes = this.$buffer.getBytes(0, count);
      const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join(' ');
      this.output = \`Size: \${len} bytes\\nFirst \${count} bytes: \${hex}\`;
    },
  },
};
</script>

<style>
.hex-ui-script {
  padding: 16px;
  font-family: system-ui, sans-serif;
  color: #d4d4d4;
}
h3 { margin: 0 0 12px; font-size: 14px; color: #cccccc; }
button {
  background: #2ea043;
  color: white;
  border: none;
  padding: 5px 14px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
button:hover { background: #3fb950; }
pre {
  background: #1a1a1a;
  padding: 10px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  margin-top: 12px;
  color: #d4d4d4;
}
</style>
`;

export const DEFAULT_NEW_SCRIPT = `// Available API:
//   buffer.length, buffer.getByte(offset), buffer.setByte(offset, value)
//   buffer.getBytes(offset, length), buffer.setBytes(offset, bytes)
//   buffer.toHex(offset?, length?), buffer.toAscii(offset?, length?)
//   buffer.resize(newSize)
//   cursor, selection.start, selection.end, selection.length
//   print(...args), hexdump(offset?, length?)
//   console.log/warn/error
//
// Export named actions (click Run first to discover them):
//   exports.myAction = function() { ... };

print("Buffer size:", buffer.length);

exports.dump = function() {
  hexdump(0, Math.min(64, buffer.length));
};
`;