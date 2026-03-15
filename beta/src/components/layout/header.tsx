/**
 * Header Component - Top toolbar with file operations and settings
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useFileHandler } from '../../hooks/use-file-handler';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { useLocale } from '../../locales';
import { formatFileSize } from '../../utils/helpers';

interface HeaderProps {
  onSearchPress?: () => void;
  onScriptPress?: () => void;
  onHelpPress?: () => void;
}

export function Header({ onSearchPress, onScriptPress, onHelpPress }: HeaderProps) {
  const { t } = useLocale();
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
    createNewFile(4096); // Create 4KB new file
  };

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
});

export default Header;
