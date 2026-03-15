import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { createPortal } from 'react-dom';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { useMobile } from '../../hooks/use-mobile';

interface ContextMenu {
  x: number;
  y: number;
  tabIndex: number;
}

function useTabContextMenu(
  tabCount: number,
  switchTab: (index: number) => void,
) {
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);

  const setTabRef = (index: number, el: HTMLElement | null) => {
    tabRefs.current[index] = el;
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handlers: Array<{ el: HTMLElement; handler: (e: MouseEvent) => void }> = [];

    Array.from({ length: tabCount }, (_, i) => {
      const el = tabRefs.current[i];
      if (!el) return;
      const handler = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        switchTab(i);
        setMenu({ x: e.clientX, y: e.clientY, tabIndex: i });
      };
      el.addEventListener('contextmenu', handler);
      handlers.push({ el, handler });
    });

    return () => {
      for (const { el, handler } of handlers) {
        el.removeEventListener('contextmenu', handler);
      }
    };
  }, [tabCount, switchTab]);

  useEffect(() => {
    if (!menu || Platform.OS !== 'web') return;
    const close = () => setMenu(null);
    const id = setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', close);
    };
  }, [menu]);

  return { menu, setMenu, setTabRef, tabRefs };
}

const menuItemStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: 13,
  color: '#212529',
  cursor: 'pointer',
};

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={menuItemStyle}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e9ecef'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {label}
    </div>
  );
}

export function TabBar() {
  const tabs = useHexEditorStore((s) => s.tabs);
  const activeTabIndex = useHexEditorStore((s) => s.activeTabIndex);
  const switchTab = useHexEditorStore((s) => s.switchTab);
  const removeTab = useHexEditorStore((s) => s.removeTab);
  const compareToTab = useHexEditorStore((s) => s.compareToTab);
  const resizeBuffer = useHexEditorStore((s) => s.resizeBuffer);
  const buffer = useHexEditorStore((s) => s.buffer);
  const { isMobile } = useMobile();

  const { menu, setMenu, setTabRef, tabRefs } = useTabContextMenu(tabs.length, switchTab);
  const [showResize, setShowResize] = useState(false);
  const [resizeValue, setResizeValue] = useState('');
  const resizeInputRef = useRef<HTMLInputElement>(null);

  const handleCompare = (targetIndex: number) => {
    compareToTab(targetIndex);
    setMenu(null);
  };

  const handleResizeClick = () => {
    setResizeValue(buffer ? String(buffer.length) : '256');
    setShowResize(true);
  };

  const handleResizeSubmit = () => {
    const size = parseInt(resizeValue, 10);
    if (!isNaN(size) && size > 0) {
      resizeBuffer(size);
    }
    setShowResize(false);
    setMenu(null);
  };

  const handleResizeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleResizeSubmit();
    } else if (e.key === 'Escape') {
      setShowResize(false);
      setMenu(null);
    }
  };

  // Auto-focus the resize input when it appears
  useEffect(() => {
    if (showResize && resizeInputRef.current) {
      resizeInputRef.current.focus();
      resizeInputRef.current.select();
    }
  }, [showResize]);

  if (tabs.length === 0) return null;

  return (
    <View style={styles.container} testID="tab-bar">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {tabs.map((tab, index) => (
          <View
            key={tab.id}
            ref={(ref) => {
              if (Platform.OS === 'web' && ref) {
                setTabRef(index, ref as unknown as HTMLElement);
              }
            }}
          >
            <TouchableOpacity
              style={[styles.tab, isMobile && styles.tabMobile, index === activeTabIndex && styles.activeTab]}
              onPress={() => switchTab(index)}
              onLongPress={() => {
                switchTab(index);
                const el = tabRefs.current[index];
                if (el) {
                  const rect = el.getBoundingClientRect();
                  setMenu({ x: rect.left, y: rect.bottom, tabIndex: index });
                }
              }}
              delayLongPress={500}
            >
              <Text
                style={[styles.tabText, index === activeTabIndex && styles.activeTabText]}
                numberOfLines={1}
              >
                {tab.isModified ? '* ' : ''}
                {tab.fileName}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={(e) => {
                  e.stopPropagation();
                  removeTab(index);
                }}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <Text style={[styles.closeText, index === activeTabIndex && styles.activeCloseText]}>
                  ×
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* Context Menu */}
      {menu && Platform.OS === 'web' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: menu.x,
              top: menu.y,
              backgroundColor: '#ffffff',
              border: '1px solid #ced4da',
              borderRadius: 4,
              paddingTop: 4,
              paddingBottom: 4,
              minWidth: 200,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              zIndex: 10000,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Resize */}
            {!showResize ? (
              <MenuItem label="Change buffer size..." onClick={handleResizeClick} />
            ) : (
              <div style={{ padding: '4px 12px' }}>
                <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>
                  New size (bytes):
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <input
                    ref={resizeInputRef}
                    type="number"
                    min="1"
                    value={resizeValue}
                    onChange={(e) => setResizeValue(e.target.value)}
                    onKeyDown={handleResizeKeyDown as any}
                    style={{
                      width: 120,
                      padding: '3px 6px',
                      fontSize: 13,
                      border: '1px solid #ced4da',
                      borderRadius: 3,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleResizeSubmit}
                    style={{
                      padding: '3px 10px',
                      fontSize: 12,
                      backgroundColor: '#007bff',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer',
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* Divider + Compare (only when multiple tabs) */}
            {tabs.length > 1 && (
              <>
                <div style={{ borderTop: '1px solid #dee2e6', margin: '4px 0' }} />
                <div style={{ fontSize: 12, color: '#6c757d', padding: '4px 12px', fontWeight: 600 }}>
                  Compare to:
                </div>
                {tabs.map((tab, i) => {
                  if (i === menu.tabIndex) return null;
                  return (
                    <MenuItem key={tab.id} label={tab.fileName} onClick={() => handleCompare(i)} />
                  );
                })}
              </>
            )}
          </div>,
          document.body
        )
      }
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#dee2e6',
    borderBottomWidth: 1,
    borderBottomColor: '#ced4da',
  },
  scrollView: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#ced4da',
    backgroundColor: '#e9ecef',
    maxWidth: 200,
  },
  tabMobile: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  activeTab: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#007bff',
  },
  tabText: {
    fontSize: 13,
    color: '#6c757d',
    flexShrink: 1,
  },
  activeTabText: {
    color: '#212529',
    fontWeight: '500',
  },
  closeButton: {
    marginLeft: 8,
    padding: 2,
  },
  closeText: {
    fontSize: 16,
    color: '#adb5bd',
    lineHeight: 16,
  },
  activeCloseText: {
    color: '#6c757d',
  },
});

export default TabBar;
