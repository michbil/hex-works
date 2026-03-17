/**
 * Script Panel - JavaScript scripting interface for the hex editor.
 * Uses CodeMirror 6 for syntax-highlighted JS editing.
 * Scripts are persisted to localStorage with hierarchical folder support.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches } from "@codemirror/search";
import { useHexEditorStore } from "../../contexts/hex-editor-store";
import { executeScript, executeAction, ScriptResult } from "./script-engine";
import { mountUIScript, UIScriptHandle } from "./vue-script-engine";
import { ScriptTree } from "./script-tree";
import {
  ScriptNode,
  loadScriptNodes,
  createScript,
  createFolder,
  updateScriptCode,
  renameNode,
  deleteNode,
  getNodePath,
} from "./script-storage";

const DEFAULT_NEW_UI_SCRIPT = `<template>
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

const DEFAULT_NEW_SCRIPT = `// Available API:
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

interface ScriptPanelProps {
  onClose: () => void;
  onBufferModified: () => void;
}

export function ScriptPanel({ onClose, onBufferModified }: ScriptPanelProps) {
  'use no memo'
  const editorRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [output, setOutput] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<ScriptResult | null>(null);
  const [exportedActions, setExportedActions] = useState<string[]>([]);
  const outputScrollRef = useRef<ScrollView>(null);

  // UI script state
  const uiContainerRef = useRef<HTMLDivElement | null>(null);
  const uiHandleRef = useRef<UIScriptHandle | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [uiRunning, setUiRunning] = useState(false);

  // Script library state
  const [scriptNodes, setScriptNodes] = useState<ScriptNode[]>(() =>
    loadScriptNodes(),
  );
  const [activeScript, setActiveScript] = useState<ScriptNode | null>(null);
  const [showTree, setShowTree] = useState(true);
  const activeScriptRef = useRef<ScriptNode | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { buffer, cursorPosition, selection } = useHexEditorStore();

  // Keep ref in sync
  useEffect(() => {
    activeScriptRef.current = activeScript;
  }, [activeScript]);

  // Auto-save callback ref — called by CodeMirror on doc change.
  // Using a ref so the extensions array (built once) always calls the latest closure.
  const onChangeRef = useRef(() => {});
  useEffect(() => {
    onChangeRef.current = () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        const script = activeScriptRef.current;
        const view = viewRef.current;
        if (script && view) {
          const code = view.state.doc.toString();
          setScriptNodes((prev) => updateScriptCode(prev, script.id, code));
        }
      }, 500);
    };
  });

  // Build CodeMirror extensions (stable reference, built once)
  const [extensions] = useState(() =>
    buildExtensions(() => onChangeRef.current()),
  );

  // Ref callback: create/destroy CodeMirror when the div mounts/unmounts.
  // Using key={activeScript.id} on the div ensures this runs on each script switch.
  // Must be stable (useCallback) so React doesn't re-invoke it on every render,
  // which would tear down and recreate the editor (and steal focus) on each store update.
  const editorRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
    editorRef.current = el;
    if (!el || Platform.OS !== "web") return;

    const code = activeScriptRef.current?.code ?? "";
    const state = EditorState.create({
      doc: code,
      extensions,
    });
    const view = new EditorView({ state, parent: el });
    viewRef.current = view;
    // Focus the editor so it's immediately typeable
    view.focus();
  }, [extensions]);

  // Cleanup auto-save timer and any mounted Vue app
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      uiHandleRef.current?.unmount();
    };
  }, []);

  // Auto-mount Vue when a UI script becomes active.
  // Depends only on activeScript.id so we mount once on selection,
  // not on every cursor/buffer change.
  useEffect(() => {
    if (activeScript?.scriptClass !== "ui" || !buffer) return;
    const container = uiContainerRef.current;
    if (!container) return;

    uiHandleRef.current?.unmount();
    uiHandleRef.current = null;
    container.innerHTML = "";
    setUiError(null);
    setUiRunning(false);

    // Use editor content (which equals saved code on open, or unsaved edits if any)
    const code = viewRef.current?.state.doc.toString() ?? activeScript.code ?? "";
    const { handle, error } = mountUIScript(
      code,
      container,
      { buffer, cursorPosition, selection },
      onBufferModified,
    );

    if (error) {
      setUiError(error);
    } else {
      uiHandleRef.current = handle;
      setUiRunning(true);
    }

    return () => {
      uiHandleRef.current?.unmount();
      uiHandleRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScript?.id]); // intentionally omit buffer/cursor/selection — Run button handles reruns

  // --- Script library actions ---

  const handleSelectScript = (script: ScriptNode) => {
    // Unmount Vue if leaving a UI script
    uiHandleRef.current?.unmount();
    uiHandleRef.current = null;
    setUiError(null);
    setUiRunning(false);

    // Flush pending save before switching
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      const prevScript = activeScriptRef.current;
      const view = viewRef.current;
      if (prevScript && view) {
        const code = view.state.doc.toString();
        setScriptNodes((prev) => updateScriptCode(prev, prevScript.id, code));
      }
    }
    // Update ref synchronously so editorRefCallback reads the correct script
    // when it fires during the commit phase (before useEffect runs).
    activeScriptRef.current = script;
    setActiveScript(script);
  };

  const handleCreateScript = (parentId: string | null) => {
    const result = createScript(
      scriptNodes,
      "New Script",
      parentId,
      DEFAULT_NEW_SCRIPT,
      "cli",
    );
    setScriptNodes(result.nodes);
    activeScriptRef.current = result.script;
    setActiveScript(result.script);
  };

  const handleCreateUIScript = (parentId: string | null) => {
    const result = createScript(
      scriptNodes,
      "New UI Script",
      parentId,
      DEFAULT_NEW_UI_SCRIPT,
      "ui",
    );
    setScriptNodes(result.nodes);
    activeScriptRef.current = result.script;
    setActiveScript(result.script);
  };

  const handleCreateFolder = (parentId: string | null) => {
    setScriptNodes((prev) => {
      const result = createFolder(prev, "New Folder", parentId);
      return result.nodes;
    });
  };

  const handleDeleteNode = (id: string) => {
    setScriptNodes((prev) => deleteNode(prev, id));
    if (activeScriptRef.current?.id === id) {
      activeScriptRef.current = null;
      setActiveScript(null);
    }
  };

  const handleRenameNode = (id: string, name: string) => {
    setScriptNodes((prev) => renameNode(prev, id, name));
    if (activeScriptRef.current?.id === id) {
      const updated = { ...activeScriptRef.current, name };
      activeScriptRef.current = updated;
      setActiveScript(updated);
    }
  };

  // --- Run/Clear ---

  const appendResult = (label: string, result: ScriptResult) => {
    setLastResult(result);
    setExportedActions(result.exportedActions);
    setOutput((prev) => {
      const newOutput = [
        ...prev,
        `--- ${label} (${result.duration.toFixed(1)}ms) ---`,
        ...result.output,
      ];
      if (result.error) {
        newOutput.push(`[ERROR] ${result.error}`);
      }
      return newOutput;
    });
    onBufferModified();
    setTimeout(() => {
      outputScrollRef.current?.scrollToEnd?.({ animated: true });
    }, 50);
  };

  const handleRunUI = () => {
    if (!viewRef.current || !buffer) return;
    const code = viewRef.current.state.doc.toString();
    const container = uiContainerRef.current;
    if (!container) return;

    // Unmount any previous Vue app
    uiHandleRef.current?.unmount();
    uiHandleRef.current = null;
    setUiError(null);
    setUiRunning(false);

    // Clear container before remounting
    container.innerHTML = '';

    const { handle, error } = mountUIScript(
      code,
      container,
      { buffer, cursorPosition, selection },
      onBufferModified,
    );

    if (error) {
      setUiError(error);
    } else {
      uiHandleRef.current = handle;
      setUiRunning(true);
    }
  };

  const handleRun = () => {
    if (!viewRef.current || !buffer) return;
    if (activeScript?.scriptClass === "ui") {
      handleRunUI();
      return;
    }
    const code = viewRef.current.state.doc.toString();
    const result = executeScript(code, { buffer, cursorPosition, selection });
    const label = activeScript ? `Run [${activeScript.name}]` : "Run";
    appendResult(label, result);
  };

  const handleRunAction = (actionName: string) => {
    if (!viewRef.current || !buffer) return;
    const code = viewRef.current.state.doc.toString();
    const result = executeAction(code, actionName, {
      buffer,
      cursorPosition,
      selection,
    });
    const label = activeScript
      ? `${activeScript.name} \u2192 ${actionName}`
      : actionName;
    appendResult(label, result);
  };

  const handleClear = () => {
    setOutput([]);
    setLastResult(null);
  };

  if (Platform.OS !== "web") {
    return (
      <View style={styles.container}>
        <Text style={styles.unsupported}>
          Scripting is only available on web platform.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.hamburger}
          onPress={() => setShowTree((prev) => !prev)}
        >
          <Text style={styles.hamburgerText}>{showTree ? "{ }" : "{}"}</Text>
        </TouchableOpacity>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {activeScript
            ? getNodePath(scriptNodes, activeScript.id)
            : "Script Editor"}
        </Text>
        <View style={styles.toolbarButtons}>
          <TouchableOpacity
            style={[
              styles.runButton,
              (!buffer || !activeScript) && styles.buttonDisabled,
            ]}
            onPress={handleRun}
            disabled={!buffer || !activeScript}
          >
            <Text style={styles.runButtonText}>{"\u25B6"} Run</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolbarButton} onPress={handleClear}>
            <Text style={styles.toolbarButtonText}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{"\u2715"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body: tree sidebar + editor/output */}
      <View style={styles.body}>
        {/* Script tree sidebar */}
        {showTree && (
          <View style={styles.treeSidebar}>
            <ScriptTree
              nodes={scriptNodes}
              activeScriptId={activeScript?.id ?? null}
              onSelectScript={handleSelectScript}
              onCreateScript={handleCreateScript}
              onCreateUIScript={handleCreateUIScript}
              onCreateFolder={handleCreateFolder}
              onDeleteNode={handleDeleteNode}
              onRenameNode={handleRenameNode}
            />
          </View>
        )}

        {/* Editor + Output */}
        <View style={styles.editorArea}>
          {activeScript ? (
            <View style={styles.splitView}>
              {/* CodeMirror Editor */}
              <View style={styles.editorPane}>
                <div
                  key={activeScript.id}
                  ref={editorRefCallback}
                  style={{
                    width: "100%",
                    height: "100%",
                    overflow: "hidden",
                  }}
                />
              </View>

              {activeScript.scriptClass === "ui" ? (
                /* Vue UI Preview Pane */
                <View style={styles.outputPane}>
                  <View style={styles.outputHeader}>
                    <Text style={styles.outputTitle}>UI Preview</Text>
                    {uiRunning && !uiError && (
                      <Text style={styles.outputSuccess}>Running</Text>
                    )}
                    {uiError && (
                      <Text style={styles.outputError}>Error</Text>
                    )}
                  </View>
                  <div
                    ref={uiContainerRef}
                    style={{ flex: 1, overflow: "auto", backgroundColor: "#1e1e1e" }}
                  />
                  {uiError && (
                    <Text style={styles.uiErrorText}>{uiError}</Text>
                  )}
                </View>
              ) : (
                <>
                  {/* Exported Actions Bar */}
                  {exportedActions.length > 0 && (
                    <View style={styles.actionsBar}>
                      <Text style={styles.actionsLabel}>Actions:</Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.actionsScroll}
                      >
                        {exportedActions.map((name) => (
                          <TouchableOpacity
                            key={name}
                            style={styles.actionButton}
                            onPress={() => handleRunAction(name)}
                          >
                            <Text style={styles.actionButtonText}>
                              {"\u25B6"} {name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}

                  {/* Output Console */}
                  <View style={styles.outputPane}>
                    <View style={styles.outputHeader}>
                      <Text style={styles.outputTitle}>Output</Text>
                      {lastResult && !lastResult.error && (
                        <Text style={styles.outputSuccess}>
                          OK ({lastResult.duration.toFixed(1)}ms)
                        </Text>
                      )}
                      {lastResult?.error && (
                        <Text style={styles.outputError}>Error</Text>
                      )}
                    </View>
                    <ScrollView ref={outputScrollRef} style={styles.outputScroll}>
                      {output.map((line, i) => (
                        <Text
                          key={i}
                          style={[
                            styles.outputLine,
                            line.startsWith("[ERROR]") && styles.outputLineError,
                            line.startsWith("[WARN]") && styles.outputLineWarn,
                            line.startsWith("---") && styles.outputLineSeparator,
                          ]}
                        >
                          {line}
                        </Text>
                      ))}
                      {output.length === 0 && (
                        <Text style={styles.outputPlaceholder}>
                          Script output will appear here. Click Run to execute.
                        </Text>
                      )}
                    </ScrollView>
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={styles.noScript}>
              <Text style={styles.noScriptText}>
                Select a script from the library or create a new one.
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

/** Build CodeMirror extensions with an onChange callback */
function buildExtensions(onChange: () => void) {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    history(),
    foldGutter(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    javascript(),
    oneDark,
    keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
    EditorView.theme({
      "&": { height: "100%", fontSize: "13px" },
      ".cm-scroller": {
        overflow: "auto",
        fontFamily: "'Menlo', 'Consolas', 'Monaco', monospace",
      },
      ".cm-content": { minHeight: "200px" },
    }),
    EditorView.domEventHandlers({
      keydown(event) {
        event.stopPropagation();
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange();
      }
    }),
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    borderLeftWidth: 1,
    borderLeftColor: "#333",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2d2d2d",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#404040",
  },
  hamburger: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    borderRadius: 3,
  },
  hamburgerText: {
    color: "#cccccc",
    fontSize: 16,
  },
  toolbarTitle: {
    color: "#cccccc",
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  toolbarButtons: {
    flexDirection: "row",
    gap: 6,
  },
  runButton: {
    backgroundColor: "#2ea043",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 4,
    flexDirection: "row",
    gap: 4,
  },
  runButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  toolbarButton: {
    backgroundColor: "#404040",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  toolbarButtonText: {
    color: "#cccccc",
    fontSize: 13,
  },
  closeButton: {
    backgroundColor: "#404040",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 4,
  },
  closeButtonText: {
    color: "#cccccc",
    fontSize: 13,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  body: {
    flex: 1,
    flexDirection: "row",
  },
  treeSidebar: {
    width: 200,
    borderRightWidth: 1,
    borderRightColor: "#333",
  },
  editorArea: {
    flex: 1,
  },
  splitView: {
    flex: 1,
    flexDirection: "column",
  },
  editorPane: {
    flex: 3,
    minHeight: 150,
  },
  actionsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#252526",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: "#404040",
    gap: 6,
  },
  actionsLabel: {
    color: "#6e7681",
    fontSize: 11,
    fontWeight: "600",
  },
  actionsScroll: {
    flexGrow: 0,
  },
  actionButton: {
    backgroundColor: "#30363d",
    borderWidth: 1,
    borderColor: "#484f58",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 4,
  },
  actionButtonText: {
    color: "#58a6ff",
    fontSize: 12,
  },
  outputPane: {
    flex: 2,
    minHeight: 100,
    borderTopWidth: 1,
    borderTopColor: "#404040",
  },
  outputHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#252526",
    gap: 8,
  },
  outputTitle: {
    color: "#cccccc",
    fontSize: 12,
    fontWeight: "600",
  },
  outputSuccess: {
    color: "#2ea043",
    fontSize: 11,
  },
  outputError: {
    color: "#f85149",
    fontSize: 11,
  },
  outputScroll: {
    flex: 1,
    padding: 8,
    backgroundColor: "#1a1a1a",
  },
  outputLine: {
    color: "#d4d4d4",
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  outputLineError: {
    color: "#f85149",
  },
  outputLineWarn: {
    color: "#d29922",
  },
  outputLineSeparator: {
    color: "#6e7681",
    marginTop: 4,
    marginBottom: 2,
  },
  outputPlaceholder: {
    color: "#6e7681",
    fontSize: 12,
    fontStyle: "italic",
  },
  noScript: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
  noScriptText: {
    color: "#6e7681",
    fontSize: 14,
  },
  unsupported: {
    color: "#999",
    fontSize: 14,
    padding: 20,
  },
  uiErrorText: {
    color: "#f85149",
    fontSize: 12,
    fontFamily: "monospace",
    padding: 8,
    backgroundColor: "#1a1a1a",
  },
});

export default ScriptPanel;
