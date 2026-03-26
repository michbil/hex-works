/**
 * Script Panel - JavaScript scripting interface for the hex editor.
 * Uses CodeMirror 6 for syntax-highlighted JS editing.
 * Scripts are loaded via a provider registry with lazy code loading.
 */

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
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
import { ScriptMeta, getNodePath } from "./providers/script-provider";
import { ScriptProviderRegistry } from "./providers/script-provider-registry";
import { LocalStorageProvider } from "./providers/localstorage/local-storage-provider";
import { BuiltinProvider } from "./providers/builtin/builtin-provider";
import { DEFAULT_NEW_SCRIPT, DEFAULT_NEW_UI_SCRIPT } from "./providers/builtin/builtin-script-templates";

/** Module-level singleton registry */
const registry = new ScriptProviderRegistry();
registry.register(new LocalStorageProvider());
registry.register(new BuiltinProvider());

const WRITABLE_PROVIDER = 'localStorage';

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

  // Script library state — metas only, no code bodies
  const [scriptMetas, setScriptMetas] = useState<ScriptMeta[]>([]);
  const [activeScript, setActiveScript] = useState<ScriptMeta | null>(null);
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const activeScriptRef = useRef<ScriptMeta | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { buffer, cursorPosition, selection } = useHexEditorStore();

  // Load metas from all providers on mount
  useEffect(() => {
    registry.loadAllMetas().then(setScriptMetas);
  }, []);

  // Keep ref in sync
  useEffect(() => {
    activeScriptRef.current = activeScript;
  }, [activeScript]);

  // Mutable callback bridge for CodeMirror onChange. Uses a closure-based holder
  // instead of useRef to satisfy react-hooks/refs and react-hooks/immutability.
  const [onChangeBridge] = useState(() => {
    let handler = () => {};
    return {
      invoke: () => handler(),
      setHandler: (fn: () => void) => { handler = fn; },
    };
  });
  useEffect(() => {
    onChangeBridge.setHandler(() => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        const script = activeScriptRef.current;
        const view = viewRef.current;
        if (script && view && !script.readOnly) {
          const code = view.state.doc.toString();
          registry.saveCode(script, code).catch(console.error);
        }
      }, 500);
    });
  });

  // Build CodeMirror extensions (stable reference, built once)
  const [extensions] = useState(() =>
    buildExtensions(onChangeBridge.invoke),
  );

  // Ref callback: create/destroy CodeMirror when the div mounts/unmounts.
  const editorRefCallback = useCallback((el: HTMLDivElement | null) => {
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }
    editorRef.current = el;
    if (!el || Platform.OS !== "web") return;

    const code = activeCode ?? "";
    const state = EditorState.create({
      doc: code,
      extensions: [
        ...extensions,
        ...(activeScriptRef.current?.readOnly ? [EditorView.editable.of(false)] : []),
      ],
    });
    const view = new EditorView({ state, parent: el });
    viewRef.current = view;
    view.focus();
  }, [extensions, activeCode]);

  // Cleanup auto-save timer and any mounted Vue app
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      uiHandleRef.current?.unmount();
    };
  }, []);

  // Auto-mount Vue when a UI script becomes active and code is loaded.
  useEffect(() => {
    if (activeScript?.scriptClass !== "ui" || !buffer || activeCode == null) return;
    const container = uiContainerRef.current;
    if (!container) return;

    uiHandleRef.current?.unmount();
    uiHandleRef.current = null;
    container.innerHTML = "";

    const code = viewRef.current?.state.doc.toString() ?? activeCode;
    const { handle, error } = mountUIScript(
      code,
      container,
      { buffer, cursorPosition, selection },
      onBufferModified,
    );

    if (error) {
      setUiError(error);
      setUiRunning(false);
    } else {
      setUiError(null);
      uiHandleRef.current = handle;
      setUiRunning(true);
    }

    return () => {
      uiHandleRef.current?.unmount();
      uiHandleRef.current = null;
    };
  }, [activeScript?.id, activeCode]); // remount when code finishes loading

  // --- Script library actions ---

  /** Flush pending auto-save for the current script */
  const flushAutoSave = async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      const prevScript = activeScriptRef.current;
      const view = viewRef.current;
      if (prevScript && view && !prevScript.readOnly) {
        const code = view.state.doc.toString();
        await registry.saveCode(prevScript, code);
      }
    }
  };

  const handleSelectScript = async (script: ScriptMeta) => {
    // Unmount Vue if leaving a UI script
    uiHandleRef.current?.unmount();
    uiHandleRef.current = null;
    setUiError(null);
    setUiRunning(false);

    await flushAutoSave();

    // Set meta immediately, code loads async
    activeScriptRef.current = script;
    setActiveScript(script);
    setActiveCode(null);
    setCodeLoading(true);

    const code = await registry.loadCode(script);
    // Guard against rapid switching: only apply if this script is still active
    if (activeScriptRef.current?.id === script.id) {
      setActiveCode(code);
      setCodeLoading(false);
    }
  };

  const handleCreateScript = async (parentId: string | null) => {
    const meta = await registry.createScript(
      WRITABLE_PROVIDER,
      "New Script",
      parentId,
      DEFAULT_NEW_SCRIPT,
      "cli",
    );
    setScriptMetas(prev => [...prev, meta]);
    activeScriptRef.current = meta;
    setActiveScript(meta);
    setActiveCode(DEFAULT_NEW_SCRIPT);
    setCodeLoading(false);
  };

  const handleCreateUIScript = async (parentId: string | null) => {
    const meta = await registry.createScript(
      WRITABLE_PROVIDER,
      "New UI Script",
      parentId,
      DEFAULT_NEW_UI_SCRIPT,
      "ui",
    );
    setScriptMetas(prev => [...prev, meta]);
    activeScriptRef.current = meta;
    setActiveScript(meta);
    setActiveCode(DEFAULT_NEW_UI_SCRIPT);
    setCodeLoading(false);
  };

  const handleCreateFolder = async (parentId: string | null) => {
    const meta = await registry.createFolder(
      WRITABLE_PROVIDER,
      "New Folder",
      parentId,
    );
    setScriptMetas(prev => [...prev, meta]);
  };

  const handleDeleteNode = async (id: string) => {
    const meta = scriptMetas.find(m => m.id === id);
    if (!meta) return;

    if (activeScriptRef.current?.id === id) {
      // Unmount Vue app before React removes the container element
      uiHandleRef.current?.unmount();
      uiHandleRef.current = null;
      setUiError(null);
      setUiRunning(false);
      activeScriptRef.current = null;
      setActiveScript(null);
      setActiveCode(null);
    }

    await registry.deleteNode(meta);
    // Reload metas to account for cascading deletes (folders with children)
    const metas = await registry.loadAllMetas();
    setScriptMetas(metas);
  };

  const handleRenameNode = async (id: string, name: string) => {
    const meta = scriptMetas.find(m => m.id === id);
    if (!meta) return;

    await registry.renameNode(meta, name);
    setScriptMetas(prev =>
      prev.map(m => m.id === id ? { ...m, name, updatedAt: Date.now() } : m),
    );
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

    uiHandleRef.current?.unmount();
    uiHandleRef.current = null;
    setUiError(null);
    setUiRunning(false);
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

  // Show editor only when code has been loaded
  const editorReady = activeScript && activeCode != null && !codeLoading;

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
            ? getNodePath(scriptMetas, activeScript.id)
            : "Script Editor"}
        </Text>
        <View style={styles.toolbarButtons}>
          <TouchableOpacity
            style={[
              styles.runButton,
              (!buffer || !editorReady) && styles.buttonDisabled,
            ]}
            onPress={handleRun}
            disabled={!buffer || !editorReady}
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
              nodes={scriptMetas}
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
          {editorReady ? (
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
          ) : activeScript && codeLoading ? (
            <View style={styles.noScript}>
              <ActivityIndicator color="#cccccc" />
              <Text style={styles.noScriptText}>Loading script...</Text>
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
    gap: 8,
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
