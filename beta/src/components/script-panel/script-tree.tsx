/**
 * Script Tree - hierarchical tree view for script library with folders.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, ScrollView, TextInput } from 'react-native';
import { ScriptNode, getChildren } from './script-storage';

interface ScriptTreeProps {
  nodes: ScriptNode[];
  activeScriptId: string | null;
  onSelectScript: (script: ScriptNode) => void;
  onCreateScript: (parentId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteNode: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
}

export function ScriptTree({
  nodes,
  activeScriptId,
  onSelectScript,
  onCreateScript,
  onCreateFolder,
  onDeleteNode,
  onRenameNode,
}: ScriptTreeProps) {
  return (
    <View style={styles.container}>
      {/* Header with actions */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scripts</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => onCreateScript(null)}
          >
            <Text style={styles.headerButtonText}>+ Script</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => onCreateFolder(null)}
          >
            <Text style={styles.headerButtonText}>+ Folder</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tree */}
      <ScrollView style={styles.treeScroll}>
        {nodes.length === 0 ? (
          <Text style={styles.emptyText}>No scripts yet. Create one to get started.</Text>
        ) : (
          <TreeLevel
            nodes={nodes}
            parentId={null}
            depth={0}
            activeScriptId={activeScriptId}
            onSelectScript={onSelectScript}
            onCreateScript={onCreateScript}
            onCreateFolder={onCreateFolder}
            onDeleteNode={onDeleteNode}
            onRenameNode={onRenameNode}
          />
        )}
      </ScrollView>
    </View>
  );
}

/** Recursive tree level renderer */
function TreeLevel({
  nodes,
  parentId,
  depth,
  activeScriptId,
  onSelectScript,
  onCreateScript,
  onCreateFolder,
  onDeleteNode,
  onRenameNode,
}: {
  nodes: ScriptNode[];
  parentId: string | null;
  depth: number;
  activeScriptId: string | null;
  onSelectScript: (script: ScriptNode) => void;
  onCreateScript: (parentId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteNode: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
}) {
  const children = getChildren(nodes, parentId);

  return (
    <>
      {children.map(node => (
        <TreeNode
          key={node.id}
          node={node}
          nodes={nodes}
          depth={depth}
          activeScriptId={activeScriptId}
          onSelectScript={onSelectScript}
          onCreateScript={onCreateScript}
          onCreateFolder={onCreateFolder}
          onDeleteNode={onDeleteNode}
          onRenameNode={onRenameNode}
        />
      ))}
    </>
  );
}

/** Single tree node (folder or script) */
function TreeNode({
  node,
  nodes,
  depth,
  activeScriptId,
  onSelectScript,
  onCreateScript,
  onCreateFolder,
  onDeleteNode,
  onRenameNode,
}: {
  node: ScriptNode;
  nodes: ScriptNode[];
  depth: number;
  activeScriptId: string | null;
  onSelectScript: (script: ScriptNode) => void;
  onCreateScript: (parentId: string | null) => void;
  onCreateFolder: (parentId: string | null) => void;
  onDeleteNode: (id: string) => void;
  onRenameNode: (id: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);

  const isFolder = node.type === 'folder';
  const isActive = node.id === activeScriptId;

  const handlePress = () => {
    if (isFolder) {
      setExpanded(prev => !prev);
    } else {
      onSelectScript(node);
    }
  };

  const handleContextMenu = () => {
    setShowContextMenu(prev => !prev);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.name) {
      onRenameNode(node.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleDelete = () => {
    setShowContextMenu(false);
    onDeleteNode(node.id);
  };

  const handleStartRename = () => {
    setShowContextMenu(false);
    setRenameValue(node.name);
    setIsRenaming(true);
  };

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.nodeRow,
          { paddingLeft: 8 + depth * 16 },
          isActive && styles.nodeRowActive,
        ]}
        onPress={handlePress}
        onLongPress={handleContextMenu}
      >
        {/* Expand/collapse icon for folders */}
        {isFolder ? (
          <Text style={styles.expandIcon}>
            {expanded ? '\u25BE' : '\u25B8'}
          </Text>
        ) : (
          <Text style={styles.scriptIcon}>{'  '}</Text>
        )}

        {/* Icon */}
        <Text style={styles.nodeIcon}>{isFolder ? '\uD83D\uDCC1' : '\uD83D\uDCDC'}</Text>

        {/* Name or rename input */}
        {isRenaming ? (
          <TextInput
            style={styles.renameInput}
            value={renameValue}
            onChangeText={setRenameValue}
            onSubmitEditing={handleRenameSubmit}
            onBlur={handleRenameSubmit}
            autoFocus
            selectTextOnFocus
          />
        ) : (
          <Text style={[styles.nodeName, isActive && styles.nodeNameActive]} numberOfLines={1}>
            {node.name}
          </Text>
        )}

        {/* Context menu button */}
        <TouchableOpacity style={styles.menuButton} onPress={handleContextMenu}>
          <Text style={styles.menuButtonText}>{'\u22EE'}</Text>
        </TouchableOpacity>
      </TouchableOpacity>

      {/* Context menu with dismiss overlay */}
      {showContextMenu && (
        <>
          <Pressable
            style={styles.contextOverlay}
            onPress={() => setShowContextMenu(false)}
          />
          <View style={[styles.contextMenu, { marginLeft: 8 + depth * 16 }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleStartRename}>
              <Text style={styles.menuItemText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={handleDelete}>
              <Text style={[styles.menuItemText, styles.menuItemDanger]}>Delete</Text>
            </TouchableOpacity>
            {isFolder && (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setShowContextMenu(false); onCreateScript(node.id); }}
                >
                  <Text style={styles.menuItemText}>New Script Here</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { setShowContextMenu(false); onCreateFolder(node.id); }}
                >
                  <Text style={styles.menuItemText}>New Folder Here</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}

      {/* Children (for folders) */}
      {isFolder && expanded && (
        <TreeLevel
          nodes={nodes}
          parentId={node.id}
          depth={depth + 1}
          activeScriptId={activeScriptId}
          onSelectScript={onSelectScript}
          onCreateScript={onCreateScript}
          onCreateFolder={onCreateFolder}
          onDeleteNode={onDeleteNode}
          onRenameNode={onRenameNode}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#252526',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  headerTitle: {
    color: '#cccccc',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 4,
  },
  headerButton: {
    backgroundColor: '#333333',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  headerButtonText: {
    color: '#cccccc',
    fontSize: 11,
  },
  treeScroll: {
    flex: 1,
  },
  emptyText: {
    color: '#6e7681',
    fontSize: 12,
    padding: 12,
    fontStyle: 'italic',
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 4,
    gap: 4,
  },
  nodeRowActive: {
    backgroundColor: '#37373d',
  },
  expandIcon: {
    color: '#cccccc',
    fontSize: 10,
    width: 12,
    textAlign: 'center',
  },
  scriptIcon: {
    width: 12,
  },
  nodeIcon: {
    fontSize: 13,
    width: 18,
  },
  nodeName: {
    color: '#cccccc',
    fontSize: 13,
    flex: 1,
  },
  nodeNameActive: {
    color: '#ffffff',
  },
  menuButton: {
    width: 20,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#6e7681',
    fontSize: 14,
  },
  renameInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    backgroundColor: '#3c3c3c',
    borderWidth: 1,
    borderColor: '#007acc',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    outlineStyle: 'none',
  } as any,
  contextOverlay: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  contextMenu: {
    position: 'relative',
    zIndex: 100,
    backgroundColor: '#2d2d2d',
    borderWidth: 1,
    borderColor: '#454545',
    borderRadius: 4,
    marginRight: 8,
    marginBottom: 2,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  menuItemText: {
    color: '#cccccc',
    fontSize: 12,
  },
  menuItemDanger: {
    color: '#f85149',
  },
});

export default ScriptTree;
