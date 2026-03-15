/**
 * SearchPanel Component - Search for hex patterns or text
 * Ported from AngularJS hex-works app
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ScrollView,
} from 'react-native';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { searchBytes } from '../../utils/helpers';

interface SearchPanelProps {
  onClose?: () => void;
}

type SearchMode = 'hex' | 'text';

interface SearchMatch {
  offset: number;
  length: number;
}

function toHexAddr(n: number): string {
  return '0x' + n.toString(16).toUpperCase().padStart(8, '0');
}

export function SearchPanel({ onClose }: SearchPanelProps) {
  const { buffer, setCursorPosition, setSelection, setScrollOffset, bytesPerLine } =
    useHexEditorStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('hex');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchResult, setSearchResult] = useState<string | null>(null);

  // Convert hex string to byte array
  const hexStringToBytes = (hex: string): Uint8Array | null => {
    const cleanHex = hex.replace(/[\s:]/g, '');
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      return null;
    }
    if (cleanHex.length === 0 || cleanHex.length % 2 !== 0) {
      return null;
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
    }
    return bytes;
  };

  const navigateToMatch = (match: SearchMatch) => {
    setCursorPosition(match.offset);
    setSelection(match.offset, match.offset + match.length - 1);
    const lineNumber = Math.floor(match.offset / bytesPerLine);
    setScrollOffset(Math.max(0, (lineNumber - 5) * bytesPerLine));
  };

  // Find all occurrences
  const findAll = () => {
    if (!buffer || !searchQuery) {
      setSearchResult('Enter a search query');
      setMatches([]);
      setActiveIndex(-1);
      return;
    }

    let pattern: Uint8Array;
    let targetBuffer: Uint8Array;
    let patternLen: number;

    if (searchMode === 'hex') {
      const p = hexStringToBytes(searchQuery);
      if (!p) {
        setSearchResult('Invalid hex pattern');
        setMatches([]);
        setActiveIndex(-1);
        return;
      }
      pattern = p;
      targetBuffer = buffer.buffer;
      patternLen = p.length;
    } else {
      const query = caseSensitive ? searchQuery : searchQuery.toLowerCase();
      const encoder = new TextEncoder();
      pattern = encoder.encode(query);
      patternLen = searchQuery.length;

      if (!caseSensitive) {
        const lowerBuffer = new Uint8Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
          const byte = buffer.getByte(i);
          lowerBuffer[i] = (byte >= 65 && byte <= 90) ? byte + 32 : byte;
        }
        targetBuffer = lowerBuffer;
      } else {
        targetBuffer = buffer.buffer;
      }
    }

    const results: SearchMatch[] = [];
    let offset = 0;
    const MAX_RESULTS = 10000;

    while (offset < buffer.length && results.length < MAX_RESULTS) {
      const found = searchBytes(targetBuffer, pattern, offset);
      if (found < 0) break;
      results.push({ offset: found, length: patternLen });
      offset = found + 1;
    }

    setMatches(results);

    if (results.length === 0) {
      setSearchResult('Pattern not found');
      setActiveIndex(-1);
    } else {
      const suffix = results.length >= MAX_RESULTS ? '+' : '';
      setSearchResult(`${results.length}${suffix} occurrences found`);
      // Navigate to first result
      setActiveIndex(0);
      navigateToMatch(results[0]);
    }
  };

  const handleMatchPress = (index: number) => {
    setActiveIndex(index);
    navigateToMatch(matches[index]);
  };

  // Find next from current active
  const findNext = () => {
    if (matches.length === 0) {
      findAll();
      return;
    }
    const next = (activeIndex + 1) % matches.length;
    setActiveIndex(next);
    navigateToMatch(matches[next]);
  };

  // Find previous
  const findPrev = () => {
    if (matches.length === 0) {
      findAll();
      return;
    }
    const prev = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(prev);
    navigateToMatch(matches[prev]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search Mode Toggle */}
      <View style={styles.modeContainer}>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'hex' && styles.modeButtonActive]}
          onPress={() => setSearchMode('hex')}
        >
          <Text
            style={[styles.modeButtonText, searchMode === 'hex' && styles.modeButtonTextActive]}
          >
            Hex
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, searchMode === 'text' && styles.modeButtonActive]}
          onPress={() => setSearchMode('text')}
        >
          <Text
            style={[styles.modeButtonText, searchMode === 'text' && styles.modeButtonTextActive]}
          >
            Text
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <TextInput
        style={styles.input}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={searchMode === 'hex' ? 'Enter hex (e.g., FF 00 AB)' : 'Enter text to search'}
        placeholderTextColor="#666666"
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={findAll}
      />

      {/* Case Sensitive Toggle (for text mode) */}
      {searchMode === 'text' && (
        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>Case sensitive</Text>
          <Switch value={caseSensitive} onValueChange={setCaseSensitive} />
        </View>
      )}

      {/* Search Buttons */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.button} onPress={findAll}>
          <Text style={styles.buttonText}>Find All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonOutline} onPress={findPrev}>
          <Text style={styles.buttonOutlineText}>{'\u25C0'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buttonOutline} onPress={findNext}>
          <Text style={styles.buttonOutlineText}>{'\u25B6'}</Text>
        </TouchableOpacity>
      </View>

      {/* Search Result */}
      {searchResult && (
        <Text
          style={[
            styles.result,
            matches.length > 0 ? styles.resultSuccess : styles.resultError,
          ]}
        >
          {searchResult}
        </Text>
      )}

      {/* Results List */}
      {matches.length > 0 && (
        <ScrollView style={styles.matchList}>
          {matches.map((match, i) => (
            <TouchableOpacity
              key={match.offset}
              style={[styles.matchRow, i === activeIndex && styles.matchRowActive]}
              onPress={() => handleMatchPress(i)}
            >
              <Text style={styles.matchIndex}>{i + 1}</Text>
              <Text style={styles.matchOffset}>{toHexAddr(match.offset)}</Text>
              <Text style={styles.matchLength}>{match.length} bytes</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#cccccc',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#858585',
    lineHeight: 24,
  },
  modeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#404040',
    overflow: 'hidden',
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#2d2d2d',
  },
  modeButtonActive: {
    backgroundColor: '#007bff',
  },
  modeButtonText: {
    fontSize: 14,
    color: '#999999',
  },
  modeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  input: {
    height: 40,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
    backgroundColor: '#2d2d2d',
    color: '#cccccc',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  optionLabel: {
    fontSize: 14,
    color: '#999999',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    backgroundColor: '#2ea043',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonOutline: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#404040',
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
  },
  buttonOutlineText: {
    color: '#cccccc',
    fontSize: 14,
  },
  result: {
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  resultSuccess: {
    color: '#4ec955',
  },
  resultError: {
    color: '#f85149',
  },
  matchList: {
    flex: 1,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#404040',
    borderRadius: 6,
    backgroundColor: '#252526',
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  matchRowActive: {
    backgroundColor: '#37373d',
  },
  matchIndex: {
    color: '#666666',
    fontSize: 12,
    width: 40,
    fontFamily: 'monospace',
  },
  matchOffset: {
    color: '#cccccc',
    fontSize: 13,
    fontFamily: 'monospace',
    flex: 1,
  },
  matchLength: {
    color: '#858585',
    fontSize: 12,
  },
});

export default SearchPanel;
