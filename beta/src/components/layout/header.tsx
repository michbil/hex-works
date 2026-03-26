/**
 * Header Component - Top toolbar with file operations and settings
 * Supports desktop (full toolbar) and mobile (hamburger menus) layouts
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useFileHandler } from '../../hooks/use-file-handler';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { useTranslation } from '../../locales';
import { formatFileSize } from '../../utils/helpers';

interface HeaderProps {
  onSearchPress?: () => void;
  onScriptPress?: () => void;
  onHelpPress?: () => void;
  isMobile?: boolean;
  onLeftMenuPress?: () => void;
  onRightMenuPress?: () => void;
}

export function Header({
  onSearchPress: _onSearchPress,
  onScriptPress: _onScriptPress,
  onHelpPress,
  isMobile,
  onLeftMenuPress,
  onRightMenuPress,
}: HeaderProps) {
  const { t } = useTranslation();
  const { openFile, saveFile, createNewFile, fileName, fileSize, isModified } = useFileHandler();
  const { buffer } = useHexEditorStore();

  const handleOpen = async () => {
    try {
      await openFile();
    } catch (error) {
      console.error('Failed to open file:', error);
    }
  };

  const handleSave = async () => {
    try {
      await saveFile();
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  };

  const handleNew = () => {
    createNewFile(4096);
  };

  if (isMobile) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.hamburger} onPress={onLeftMenuPress}>
          {Platform.OS === 'web' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <Text style={styles.hamburgerText}>☰</Text>
          )}
        </TouchableOpacity>

        <View style={styles.mobileTitleArea}>
          <Text style={styles.mobileTitle}>Hex Works</Text>
          {fileName && (
            <Text style={styles.mobileFileName} numberOfLines={1}>
              {fileName}
              {isModified ? ' *' : ''}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.hamburger} onPress={onRightMenuPress}>
          {Platform.OS === 'web' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          ) : (
            <Text style={styles.hamburgerText}>🔧</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Logo/Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Hex Works</Text>
      </View>

      {/* File Operations */}
      <View style={styles.buttonGroup}>
        <TouchableOpacity style={styles.button} onPress={handleNew}>
          <Text style={styles.buttonText}>{t('new')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={handleOpen}>
          <Text style={styles.buttonText}>{t('open')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !buffer && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!buffer}
        >
          <Text style={[styles.buttonText, !buffer && styles.buttonTextDisabled]}>
            {t('save')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* File Info */}
      <View style={styles.fileInfo}>
        {fileName && (
          <>
            <Text style={styles.fileName}>
              {fileName}
              {isModified && <Text style={styles.modified}> *</Text>}
            </Text>
            <Text style={styles.fileSize}>{formatFileSize(fileSize)}</Text>
          </>
        )}
      </View>

      {/* Help */}
      <TouchableOpacity style={styles.helpButton} onPress={onHelpPress}>
        <Text style={styles.helpButtonText}>?</Text>
      </TouchableOpacity>
    </View>
  );
}

/** File operations menu content for the left drawer on mobile */
export function FileMenu({
  onClose,
  onHelpPress,
}: {
  onClose: () => void;
  onHelpPress?: () => void;
}) {
  const { t } = useTranslation();
  const { openFile, saveFile, createNewFile, fileName, fileSize, isModified } = useFileHandler();
  const { buffer } = useHexEditorStore();

  const handleAction = async (action: () => unknown) => {
    try {
      await action();
    } catch (error) {
      console.error('File action failed:', error);
    }
    onClose();
  };

  return (
    <View style={styles.fileMenu}>
      <Text style={styles.fileMenuTitle}>File</Text>

      {fileName && (
        <View style={styles.fileMenuInfo}>
          <Text style={styles.fileMenuFileName}>
            {fileName}
            {isModified ? ' *' : ''}
          </Text>
          <Text style={styles.fileMenuFileSize}>{formatFileSize(fileSize)}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.fileMenuItem} onPress={() => handleAction(() => createNewFile(4096))}>
        <Text style={styles.fileMenuItemText}>{t('new')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.fileMenuItem} onPress={() => handleAction(openFile)}>
        <Text style={styles.fileMenuItemText}>{t('open')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.fileMenuItem, !buffer && styles.fileMenuItemDisabled]}
        onPress={() => handleAction(saveFile)}
        disabled={!buffer}
      >
        <Text style={[styles.fileMenuItemText, !buffer && styles.fileMenuItemTextDisabled]}>
          {t('save')}
        </Text>
      </TouchableOpacity>

      <View style={styles.fileMenuDivider} />

      <TouchableOpacity
        style={styles.fileMenuItem}
        onPress={() => {
          onClose();
          onHelpPress?.();
        }}
      >
        <Text style={styles.fileMenuItemText}>Help</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#343a40',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
  },
  titleContainer: {
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  button: {
    backgroundColor: '#495057',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
  },
  buttonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonTextDisabled: {
    color: '#adb5bd',
  },
  fileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 'auto',
  },
  fileName: {
    color: '#ffffff',
    fontSize: 14,
  },
  modified: {
    color: '#ffc107',
  },
  fileSize: {
    color: '#adb5bd',
    fontSize: 13,
  },
  helpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#495057',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },

  // Mobile header
  hamburger: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hamburgerText: {
    color: '#ffffff',
    fontSize: 24,
  },
  mobileTitleArea: {
    flex: 1,
    alignItems: 'center',
  },
  mobileTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  mobileFileName: {
    fontSize: 12,
    color: '#adb5bd',
    marginTop: 2,
  },

  // File menu (left drawer content)
  fileMenu: {
    flex: 1,
    paddingTop: 16,
  },
  fileMenuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  fileMenuInfo: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  fileMenuFileName: {
    color: '#ffffff',
    fontSize: 14,
  },
  fileMenuFileSize: {
    color: '#adb5bd',
    fontSize: 12,
    marginTop: 4,
  },
  fileMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fileMenuItemDisabled: {
    opacity: 0.4,
  },
  fileMenuItemText: {
    color: '#ffffff',
    fontSize: 16,
  },
  fileMenuItemTextDisabled: {
    color: '#6c757d',
  },
  fileMenuDivider: {
    height: 1,
    backgroundColor: '#404040',
    marginVertical: 8,
  },
});

export default Header;
