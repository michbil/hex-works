/**
 * HexView Component - Canvas-based hex editor view
 * Ported from AngularJS hex-works app
 * Supports desktop (mouse) and mobile (touch) interactions
 */

import React, { useRef, useEffect, useEffectEvent, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createPortal } from 'react-dom';
import { useHexEditorStore } from '../../contexts/hex-editor-store';
import { byteToHex, addressToHex, byteToChar, stringToByteSeq } from '../../utils/helpers';

// Heatmap color: 0 changes → transparent, max → semi-transparent red
function heatColor(changeCount: number, maxChanges: number): string | null {
  if (maxChanges === 0 || changeCount === 0) return null;
  const t = changeCount / maxChanges;
  if (t <= 0.5) {
    const s = t * 2;
    const r = Math.round(30 + s * 225);
    const g = Math.round(30 + s * 195);
    const b = Math.round(80 * (1 - s));
    return `rgba(${r},${g},${b},0.45)`;
  }
  const s = (t - 0.5) * 2;
  const r = 255;
  const g = Math.round(225 * (1 - s));
  return `rgba(${r},${g},0,0.45)`;
}

// Color map for byte highlighting
const COLOR_MAP: Record<number, string> = {
  0: '#ffffff',
  1: '#E57373', // Red
  2: '#80CBC4', // Teal
  3: '#FFEB3B', // Yellow
  4: '#64B5F6', // Blue
  5: '#B39DDB', // Purple
  6: '#A1887F', // Brown
  7: '#9E9E9E', // Grey
  8: '#ADD8E6', // Light blue (selection)
};

function CtxMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '6px 12px',
        fontSize: 13,
        color: '#212529',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#e9ecef'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {label}
    </div>
  );
}

/** Calculate optimal bytesPerLine for a given pixel width and font size */
function computeBytesPerLine(width: number, charWidth: number): number {
  'use no memo';
  // Layout: address(9 chars) + hex(N * 3 chars) + gap(2 chars) + ascii(N chars) + scrollbar(20px)
  // Solve for N: width >= charWidth * (9 + 3N + 2 + N) + 20
  //   width - 20 >= charWidth * (11 + 4N)
  //   N <= (((width - 20) / charWidth) - 11) / 4
  const available = ((width - 20) / charWidth - 11) / 4;
  const n = Math.floor(available);
  // Clamp to powers of 2 or reasonable values: 4, 8, 12, 16, 24, 32
  const options = [4, 8, 12, 16, 24, 32];
  for (let i = options.length - 1; i >= 0; i--) {
    if (n >= options[i]) return options[i];
  }
  return 4;
}

interface HexViewProps {
  width?: number;
  height?: number;
  fontSize?: number;
  fontFamily?: string;
  isMobile?: boolean;
}

export function HexView({
  width: propWidth,
  height: propHeight,
  fontSize: propFontSize,
  fontFamily = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Consolas, Monaco, monospace',
  }),
  isMobile = false,
}: HexViewProps) {
  const fontSize = propFontSize ?? (isMobile ? 12 : 14);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<View>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const [dimensions, setDimensions] = useState({ width: propWidth || 800, height: propHeight || 400 });
  const [focused, setFocused] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [ctxDialog, setCtxDialog] = useState<'fill' | 'xor' | null>(null);
  const [fillValue, setFillValue] = useState('');

  // Scrollbar drag state
  const scrollbarGripRef = useRef(false);
  const scrollbarDragOffsetRef = useRef(0);
  const scrollbarParamsRef = useRef<{ top: number; height: number } | null>(null);

  // Touch state
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchScrollStartOffsetRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchScrollingRef = useRef(false);
  // Momentum scrolling
  const momentumRef = useRef<{ velocity: number; lastY: number; lastTime: number } | null>(null);
  const momentumRafRef = useRef<number | null>(null);

  // Get device pixel ratio for sharp rendering on high-DPI displays
  const dpr = Platform.OS === 'web' ? window.devicePixelRatio || 1 : 1;

  const SCROLLBAR_WIDTH = isMobile ? 10 : 10;
  const MIN_GRIP_HEIGHT = isMobile ? 44 : 30;

  const {
    buffer,
    cursorPosition,
    scrollOffset,
    bytesPerLine,
    selection,
    isEditing,
    editNibble,
    setCursorPosition,
    setScrollOffset,
    setSelection,
    setByte,
    setEditNibble,
    setIsEditing,
    clearMarkers,
    swapBytes,
    fillSelection,
    getColorBuffer,
    setBytesPerLine,
    heatmapChangeCounts,
    heatmapMaxChanges,
  } = useHexEditorStore();

  // Adaptive bytesPerLine on mobile when dimensions change
  useEffect(() => {
    if (!isMobile) return;
    const charWidth = fontSize * 0.6;
    const optimal = computeBytesPerLine(dimensions.width, charWidth);
    if (optimal !== bytesPerLine) {
      setBytesPerLine(optimal);
    }
  }, [isMobile, dimensions.width, fontSize, bytesPerLine, setBytesPerLine]);

  // Calculate layout metrics
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize + 4;
  const addressWidth = charWidth * 9;
  const useSpaces = true;
  const hexCharWidth = useSpaces ? 3 : 2;
  const gap = charWidth * 2;
  const scrollbarX = dimensions.width - SCROLLBAR_WIDTH;
  const visibleRows = Math.floor(dimensions.height / lineHeight);

  // Handle resize — measure actual container element
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const el = containerRef.current as unknown as HTMLElement;
    if (!el) return;

    const measure = () => {
      const w = propWidth || el.clientWidth;
      const h = propHeight || el.clientHeight;
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    };

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      requestAnimationFrame(measure);
      return () => ro.disconnect();
    }

    requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [propWidth, propHeight]);

  // Get background color for a byte
  const getByteBackground = (index: number): string => {
    if (!buffer) return COLOR_MAP[0];

    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(selection.start, selection.end);
    if (index >= selStart && index <= selEnd && selStart !== selEnd) {
      return '#999999';
    }

    const colorBuf = getColorBuffer() ?? buffer;
    const colorCode = colorBuf.getColor?.(index) ?? 0;
    return COLOR_MAP[colorCode] || COLOR_MAP[0];
  };

  // Check if byte is marked (modified)
  const isMarked = (index: number): boolean => {
    return buffer?.isMarked?.(index) ?? false;
  };

  // Calculate scrollbar parameters
  const getScrollbarParams = () => {
    if (!buffer) return null;
    const totalBytes = buffer.length;
    const totalLines = Math.ceil(totalBytes / bytesPerLine);
    if (totalLines <= visibleRows) return null;

    const maxOffset = Math.max(0, (totalLines - visibleRows) * bytesPerLine);
    const canvasHeight = dimensions.height;
    let gripHeight = canvasHeight * visibleRows / totalLines;
    if (gripHeight < MIN_GRIP_HEIGHT) gripHeight = MIN_GRIP_HEIGHT;

    const gripTop = maxOffset > 0
      ? (canvasHeight - gripHeight) * scrollOffset / maxOffset
      : 0;

    return { top: gripTop, height: gripHeight, maxOffset };
  };

  // Reverse-compute: pixel Y → buffer offset (for scrollbar drag)
  const reverseScrollCompute = (y: number) => {
    if (!buffer) return 0;
    const totalLines = Math.ceil(buffer.length / bytesPerLine);
    const maxOffset = Math.max(0, (totalLines - visibleRows) * bytesPerLine);
    const params = scrollbarParamsRef.current;
    if (!params) return 0;

    const canvasHeight = dimensions.height;
    let pos = y;
    if (pos + params.height > canvasHeight) pos = canvasHeight - params.height;
    if (pos < 0) pos = 0;

    const ratio = pos / (canvasHeight - params.height);
    let offset = Math.round(maxOffset * ratio / bytesPerLine) * bytesPerLine;
    if (offset < 0) offset = 0;
    if (offset > maxOffset) offset = maxOffset;
    return offset;
  };

  // Helper: compute max scroll offset
  const getMaxOffset = () => {
    if (!buffer) return 0;
    const totalLines = Math.ceil(buffer.length / bytesPerLine);
    return Math.max(0, (totalLines - visibleRows) * bytesPerLine);
  };

  // Helper: clamp scroll offset
  const clampOffset = (offset: number) => {
    return Math.max(0, Math.min(getMaxOffset(), offset));
  };

  // Hit-test: canvas coordinates → byte index
  const hitTestByte = (x: number, y: number): { byteIndex: number; isAscii: boolean } | null => {
    if (!buffer) return null;

    const row = Math.floor(y / lineHeight);
    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const lineOffset = (startLine + row) * bytesPerLine;

    let col = -1;
    let isAscii = false;

    const hexEnd = addressWidth + charWidth * bytesPerLine * hexCharWidth;
    const asciiStart = hexEnd + gap;

    if (x >= addressWidth && x < hexEnd) {
      col = Math.floor((x - addressWidth) / (charWidth * hexCharWidth));
      isAscii = false;
    } else if (x >= asciiStart) {
      col = Math.floor((x - asciiStart) / charWidth);
      isAscii = true;
    }

    if (col < 0 || col >= bytesPerLine) return null;

    const byteIndex = lineOffset + col;
    if (byteIndex < 0 || byteIndex >= buffer.length) return null;

    return { byteIndex, isAscii };
  };

  // Render the hex view on canvas
  const render = () => {
    if (Platform.OS !== 'web') return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !buffer) return;

    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'bottom';
    ctx.imageSmoothingEnabled = false;

    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const bufferLength = buffer.length;

    // Pass 1: Draw blurred heatmap backgrounds (when comparison data exists)
    if (heatmapChangeCounts && heatmapChangeCounts.length > 0 && heatmapMaxChanges > 0) {
      // Draw heatmap to offscreen canvas, then apply blur once
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext('2d');
      if (offCtx) {
        offCtx.scale(dpr, dpr);
        for (let row = 0; row < visibleRows; row++) {
          const lineOffset = (startLine + row) * bytesPerLine;
          if (lineOffset >= bufferLength) break;
          const y = (row + 1) * lineHeight;
          let hexX = addressWidth;
          let asciiX = addressWidth + charWidth * bytesPerLine * hexCharWidth + gap;

          for (let col = 0; col < bytesPerLine; col++) {
            const byteIndex = lineOffset + col;
            if (byteIndex >= bufferLength) break;

            if (byteIndex < heatmapChangeCounts.length) {
              const cc = heatmapChangeCounts[byteIndex];
              if (cc > 0) {
                const color = heatColor(cc, heatmapMaxChanges);
                if (color) {
                  offCtx.fillStyle = color;
                  offCtx.fillRect(hexX, y - lineHeight + 2, charWidth * hexCharWidth, lineHeight);
                  offCtx.fillRect(asciiX, y - lineHeight + 2, charWidth, lineHeight);
                }
              }
            }
            hexX += charWidth * hexCharWidth;
            asciiX += charWidth;
          }
        }
        // Apply blur once to entire heatmap layer
        ctx.save();
        ctx.filter = 'blur(8px)';
        ctx.drawImage(offscreen, 0, 0);
        ctx.restore();
      }
    }

    // Pass 2: Draw normal content (address, hex, ascii, selection/color backgrounds)
    for (let row = 0; row < visibleRows; row++) {
      const lineOffset = (startLine + row) * bytesPerLine;
      if (lineOffset >= bufferLength) break;

      const y = (row + 1) * lineHeight;

      ctx.fillStyle = '#0000FF';
      ctx.fillText(addressToHex(lineOffset, 8), 0, y);

      let hexX = addressWidth;
      let asciiX = addressWidth + charWidth * bytesPerLine * hexCharWidth + gap;

      for (let col = 0; col < bytesPerLine; col++) {
        const byteIndex = lineOffset + col;
        if (byteIndex >= bufferLength) break;

        const byte = buffer.getByte(byteIndex);
        const bg = getByteBackground(byteIndex);
        const marked = isMarked(byteIndex);

        if (bg !== '#ffffff') {
          ctx.fillStyle = bg;
          ctx.fillRect(hexX, y - lineHeight + 2, charWidth * hexCharWidth, lineHeight);
          ctx.fillRect(asciiX, y - lineHeight + 2, charWidth, lineHeight);
        }

        ctx.fillStyle = marked ? '#F44336' : '#000000';
        ctx.fillText(byteToHex(byte), hexX, y);
        ctx.fillText(byteToChar(byte), asciiX, y);

        hexX += charWidth * hexCharWidth;
        asciiX += charWidth;
      }
    }

    // Draw scrollbar
    const sbParams = getScrollbarParams();
    scrollbarParamsRef.current = sbParams;
    if (sbParams) {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(scrollbarX, 0, SCROLLBAR_WIDTH, dimensions.height);
      ctx.fillStyle = '#aaaaaa';
      ctx.fillRect(scrollbarX, sbParams.top, SCROLLBAR_WIDTH, sbParams.height);
    }
  };

  // Render cursor
  const renderCursor = () => {
    if (Platform.OS !== 'web') return;

    const canvas = cursorCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !buffer) return;

    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (!focused) return;

    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const cursorLine = Math.floor(cursorPosition / bytesPerLine);
    const cursorCol = cursorPosition % bytesPerLine;

    if (cursorLine < startLine || cursorLine >= startLine + visibleRows) return;

    const row = cursorLine - startLine;
    const y = (row + 1) * lineHeight;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#449';

    if (textMode) {
      const asciiX = addressWidth + charWidth * bytesPerLine * hexCharWidth + gap + cursorCol * charWidth;
      ctx.fillRect(asciiX, y - lineHeight + 2, charWidth, lineHeight);
    } else {
      const hexX = addressWidth + cursorCol * charWidth * hexCharWidth;
      const nibbleOffset = editNibble === 'low' ? charWidth : 0;
      ctx.fillRect(hexX + nibbleOffset, y - lineHeight + 2, charWidth, lineHeight);
    }
  };

  // Re-render when state changes
  useEffect(() => {
    render();
    renderCursor();
  });

  // Global mouse handlers for scrollbar drag
  const onScrollbarDrag = useEffectEvent((e: MouseEvent) => {
    if (!scrollbarGripRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const offset = reverseScrollCompute(y + scrollbarDragOffsetRef.current);
    setScrollOffset(offset);
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleGlobalMouseUp = () => {
      scrollbarGripRef.current = false;
    };

    window.addEventListener('mousemove', onScrollbarDrag);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', onScrollbarDrag);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Mouse event handlers
  const handleMouseEvent = (event: React.MouseEvent<HTMLCanvasElement>, eventType: 'down' | 'up' | 'move') => {
    if (!buffer) return;
    if (event.button === 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scrollbar interaction
    if (x > scrollbarX - 5) {
      if (eventType === 'down') {
        const sbParams = scrollbarParamsRef.current;
        if (sbParams) {
          if (y >= sbParams.top && y <= sbParams.top + sbParams.height) {
            scrollbarGripRef.current = true;
            scrollbarDragOffsetRef.current = sbParams.top - y;
          } else {
            scrollbarGripRef.current = true;
            scrollbarDragOffsetRef.current = -(sbParams.height / 2);
            const offset = reverseScrollCompute(y + scrollbarDragOffsetRef.current);
            setScrollOffset(offset);
          }
        }
      }
      return;
    }

    if (scrollbarGripRef.current) return;

    const hit = hitTestByte(x, y);
    if (!hit) return;

    const { byteIndex, isAscii } = hit;

    if (eventType === 'down') {
      canvas.focus();
      setTextMode(isAscii);
      setCursorPosition(byteIndex);
      setIsEditing(true);

      if (!isAscii) {
        const col = byteIndex % bytesPerLine;
        const hexX = addressWidth + col * charWidth * hexCharWidth;
        const relX = x - hexX;
        setEditNibble(relX < charWidth ? 'high' : 'low');
      }

      setSelection(byteIndex, byteIndex);
    } else if (eventType === 'move' && event.buttons === 1) {
      setSelection(selection.start, byteIndex);
    }
  };

  // ── Touch handlers (mobile) ──────────────────────────────────────

  useEffect(() => {
    if (Platform.OS !== 'web' || !isMobile) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      // Cancel any ongoing momentum animation
      if (momentumRafRef.current) {
        cancelAnimationFrame(momentumRafRef.current);
        momentumRafRef.current = null;
      }

      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      touchStartRef.current = { x, y, time: Date.now() };
      touchScrollStartOffsetRef.current = scrollOffset;
      isTouchScrollingRef.current = false;
      momentumRef.current = { velocity: 0, lastY: y, lastTime: Date.now() };

      // Start long-press timer for context menu / selection
      longPressTimerRef.current = setTimeout(() => {
        // Long press → show context menu at center of screen
        const hit = hitTestByte(x, y);
        if (hit) {
          setCursorPosition(hit.byteIndex);
          setIsEditing(true);
          setSelection(hit.byteIndex, hit.byteIndex);
        }
        setCtxMenu({
          x: window.innerWidth / 2 - 90,
          y: window.innerHeight / 2 - 100,
        });
        longPressTimerRef.current = null;
      }, 500);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = canvas.getBoundingClientRect();
      const y = touch.clientY - rect.top;

      if (!touchStartRef.current) return;

      const dy = touchStartRef.current.y - y;

      // If moved enough, cancel long-press and treat as scroll
      if (Math.abs(dy) > 8) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        isTouchScrollingRef.current = true;
      }

      if (isTouchScrollingRef.current) {
        // Track velocity for momentum
        const now = Date.now();
        if (momentumRef.current) {
          const dt = now - momentumRef.current.lastTime;
          if (dt > 0) {
            momentumRef.current.velocity = (momentumRef.current.lastY - y) / dt;
            momentumRef.current.lastY = y;
            momentumRef.current.lastTime = now;
          }
        }

        const linesDelta = dy / lineHeight;
        const bytesDelta = Math.round(linesDelta) * bytesPerLine;
        const newOffset = clampOffset(touchScrollStartOffsetRef.current + bytesDelta);
        setScrollOffset(newOffset);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      if (!isTouchScrollingRef.current && touchStartRef.current) {
        // Tap — position cursor
        const { x, y } = touchStartRef.current;
        const hit = hitTestByte(x, y);
        if (hit) {
          setCursorPosition(hit.byteIndex);
          setTextMode(hit.isAscii);
          setIsEditing(true);
          setSelection(hit.byteIndex, hit.byteIndex);
          setFocused(true);
          // Focus hidden input to bring up keyboard
          hiddenInputRef.current?.focus();
        }
      } else if (isTouchScrollingRef.current && momentumRef.current) {
        // Momentum scrolling
        const velocity = momentumRef.current.velocity; // px/ms
        if (Math.abs(velocity) > 0.3) {
          let v = velocity;
          const friction = 0.95;
          const tick = () => {
            v *= friction;
            if (Math.abs(v) < 0.01) return;
            const deltaLines = v * 16 / lineHeight; // 16ms frame
            const deltaBytes = Math.round(deltaLines) * bytesPerLine;
            if (deltaBytes === 0) { v *= 2; } // nudge if rounded to 0
            const currentOffset = useHexEditorStore.getState().scrollOffset;
            setScrollOffset(clampOffset(currentOffset + deltaBytes));
            momentumRafRef.current = requestAnimationFrame(tick);
          };
          momentumRafRef.current = requestAnimationFrame(tick);
        }
      }

      touchStartRef.current = null;
      isTouchScrollingRef.current = false;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (momentumRafRef.current) cancelAnimationFrame(momentumRafRef.current);
    };
  });

  // Wheel handler for scrolling
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (event: WheelEvent) => {
      if (!buffer) return;
      event.preventDefault();

      const delta = Math.sign(event.deltaY) * bytesPerLine * 3;
      const newOffset = clampOffset(scrollOffset + delta);
      setScrollOffset(newOffset);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  });

  // Focus handlers
  const handleFocus = () => setFocused(true);
  const handleBlur = () => setFocused(false);

  // Clipboard: copy selected bytes as hex string
  const handleCopy = async () => {
    if (!buffer) return;
    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(selection.start, selection.end);
    const length = selStart === selEnd ? 1 : selEnd - selStart + 1;
    const start = selStart === selEnd ? cursorPosition : selStart;

    const hexParts: string[] = [];
    for (let i = 0; i < length; i++) {
      if (start + i < buffer.length) {
        hexParts.push(byteToHex(buffer.getByte(start + i)));
      }
    }
    const text = hexParts.join(' ');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  };

  // Clipboard: paste hex string at cursor
  const handlePaste = async () => {
    if (!buffer) return;
    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return;
    }
    const cleaned = text.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length === 0 || cleaned.length % 2 !== 0) return;

    const bytes: number[] = [];
    for (let i = 0; i < cleaned.length; i += 2) {
      bytes.push(parseInt(cleaned.substring(i, i + 2), 16));
    }

    let pos = cursorPosition;
    for (const b of bytes) {
      if (pos >= buffer.length) break;
      setByte(pos, b);
      pos++;
    }
    setCursorPosition(Math.min(pos, buffer.length - 1));
    setSelection(cursorPosition, Math.min(cursorPosition + bytes.length - 1, buffer.length - 1));
  };

  // Attach native contextmenu to canvas (desktop right-click)
  useEffect(() => {
    if (Platform.OS !== 'web' || isMobile) return;
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [isMobile]);

  // Close context menu on outside click/tap
  useEffect(() => {
    if (!ctxMenu || Platform.OS !== 'web') return;
    const close = () => { setCtxMenu(null); setCtxDialog(null); };
    const id = setTimeout(() => {
      window.addEventListener('mousedown', close);
      window.addEventListener('touchstart', close);
    }, 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', close);
      window.removeEventListener('touchstart', close);
    };
  }, [ctxMenu]);

  const handleFillSubmit = () => {
    const seq = stringToByteSeq(fillValue);
    if (seq.length > 0) {
      fillSelection(seq, ctxDialog === 'xor');
    }
    setCtxMenu(null);
    setCtxDialog(null);
    setFillValue('');
  };

  // Keyboard handler — shared between canvas keydown and hidden input
  const handleKeyDown = (event: React.KeyboardEvent | KeyboardEvent) => {
      if (!buffer) return;

      const { key, shiftKey, ctrlKey, metaKey } = event;
      const mod = ctrlKey || metaKey;

      if (mod && key.toLowerCase() === 'c') {
        event.preventDefault();
        handleCopy();
        return;
      }
      if (mod && key.toLowerCase() === 'v') {
        event.preventDefault();
        handlePaste();
        return;
      }
      if (mod && key.toLowerCase() === 'a') {
        event.preventDefault();
        setSelection(0, buffer.length - 1);
        return;
      }

      let newPosition = cursorPosition;
      let d = 0;

      switch (key) {
        case 'ArrowLeft':
          if (!textMode && editNibble === 'low') {
            setEditNibble('high');
          } else {
            setEditNibble('low');
            d = -1;
          }
          break;
        case 'ArrowRight':
          if (!textMode && editNibble === 'high') {
            setEditNibble('low');
          } else {
            setEditNibble('high');
            d = 1;
          }
          break;
        case 'ArrowUp':
          d = -bytesPerLine;
          break;
        case 'ArrowDown':
          d = bytesPerLine;
          break;
        case 'PageUp':
          d = -bytesPerLine * visibleRows;
          break;
        case 'PageDown':
          d = bytesPerLine * visibleRows;
          break;
        case 'Home':
          newPosition = ctrlKey || metaKey ? 0 : Math.floor(cursorPosition / bytesPerLine) * bytesPerLine;
          d = newPosition - cursorPosition;
          break;
        case 'End':
          newPosition = ctrlKey || metaKey
            ? buffer.length - 1
            : Math.floor(cursorPosition / bytesPerLine) * bytesPerLine + bytesPerLine - 1;
          d = newPosition - cursorPosition;
          break;
        default:
          if (isEditing && !textMode) {
            const hexMatch = key.match(/^[0-9a-fA-F]$/);
            if (hexMatch) {
              event.preventDefault();
              const digit = parseInt(key, 16);
              const currentByte = buffer.getByte(cursorPosition);

              if (editNibble === 'high') {
                const newByte = (digit << 4) | (currentByte & 0x0f);
                setByte(cursorPosition, newByte);
                setEditNibble('low');
              } else {
                const newByte = (currentByte & 0xf0) | digit;
                setByte(cursorPosition, newByte);
                setEditNibble('high');
                d = 1;
              }
            } else {
              return;
            }
          } else if (isEditing && textMode) {
            if (key.length === 1 && key.charCodeAt(0) >= 0x20 && key.charCodeAt(0) < 0x7f) {
              event.preventDefault();
              setByte(cursorPosition, key.charCodeAt(0));
              d = 1;
            } else {
              return;
            }
          } else {
            return;
          }
          break;
      }

      event.preventDefault();

      newPosition = cursorPosition + d;
      newPosition = Math.max(0, Math.min(buffer.length - 1, newPosition));
      setCursorPosition(newPosition);

      if (shiftKey) {
        setSelection(selection.start, newPosition);
      } else {
        setSelection(newPosition, newPosition);
      }

      const cursorLine = Math.floor(newPosition / bytesPerLine);
      const startLine = Math.floor(scrollOffset / bytesPerLine);
      const endLine = startLine + visibleRows - 1;

      if (cursorLine < startLine) {
        setScrollOffset(cursorLine * bytesPerLine);
      } else if (cursorLine > endLine) {
        setScrollOffset((cursorLine - visibleRows + 1) * bytesPerLine);
      }
  };

  // Hidden input handler for mobile keyboard
  const handleHiddenInput = (e: any) => {
    const input = e.currentTarget as HTMLInputElement;
    const value = input.value;
    if (!value || !buffer) {
      input.value = '';
      return;
    }

    // Process each character
    for (const char of value) {
      if (!textMode) {
        // Hex mode: accept hex chars
        if (/^[0-9a-fA-F]$/.test(char)) {
          const digit = parseInt(char, 16);
          const currentByte = buffer.getByte(cursorPosition);
          if (editNibble === 'high') {
            setByte(cursorPosition, (digit << 4) | (currentByte & 0x0f));
            setEditNibble('low');
          } else {
            setByte(cursorPosition, (currentByte & 0xf0) | digit);
            setEditNibble('high');
            const next = Math.min(cursorPosition + 1, buffer.length - 1);
            setCursorPosition(next);
            setSelection(next, next);
          }
        }
      } else {
        // Text mode: accept printable ASCII
        const code = char.charCodeAt(0);
        if (code >= 0x20 && code < 0x7f) {
          setByte(cursorPosition, code);
          const next = Math.min(cursorPosition + 1, buffer.length - 1);
          setCursorPosition(next);
          setSelection(next, next);
        }
      }
    }

    input.value = '';
  };

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        {/* Native implementation placeholder */}
      </View>
    );
  }

  return (
    <View ref={containerRef} style={styles.container}>
      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{
          ...styles.canvas as object,
          width: dimensions.width,
          height: dimensions.height,
          touchAction: 'none', // Prevent browser touch gestures
        }}
        tabIndex={isMobile ? -1 : 0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={isMobile ? undefined : (e) => handleMouseEvent(e, 'down')}
        onMouseUp={isMobile ? undefined : (e) => handleMouseEvent(e, 'up')}
        onMouseMove={isMobile ? undefined : (e) => handleMouseEvent(e, 'move')}
        onKeyDown={isMobile ? undefined : handleKeyDown as any}
      />
      <canvas
        ref={cursorCanvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{
          ...styles.canvas as object,
          ...styles.cursorCanvas as object,
          width: dimensions.width,
          height: dimensions.height,
        }}
      />

      {/* Hidden input for mobile keyboard */}
      {isMobile && (
        <input
          ref={hiddenInputRef}
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode={textMode ? 'text' : 'none'}
          onInput={handleHiddenInput}
          onKeyDown={(e) => {
            // Handle navigation keys from mobile keyboard
            if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.key)) {
              e.preventDefault();
              handleKeyDown(e.nativeEvent);
            }
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            opacity: 0,
            padding: 0,
            border: 'none',
            outline: 'none',
            caretColor: 'transparent',
            fontSize: 16, // Prevent iOS zoom on focus
          }}
        />
      )}

      {/* Editor Context Menu */}
      {ctxMenu && buffer && createPortal(
        <div
          style={{
            position: 'fixed',
            left: ctxMenu.x,
            top: ctxMenu.y,
            backgroundColor: '#ffffff',
            border: '1px solid #ced4da',
            borderRadius: 4,
            paddingTop: 4,
            paddingBottom: 4,
            minWidth: 180,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            zIndex: 10000,
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <CtxMenuItem label="Clear markers" onClick={() => { clearMarkers(); setCtxMenu(null); }} />
          <CtxMenuItem label="Swap bytes" onClick={() => { swapBytes(); setCtxMenu(null); }} />
          <CtxMenuItem label="FILL..." onClick={() => { setCtxDialog('fill'); setFillValue(''); }} />
          <CtxMenuItem label="XOR..." onClick={() => { setCtxDialog('xor'); setFillValue(''); }} />

          {ctxDialog && (
            <div style={{ padding: '4px 12px', borderTop: '1px solid #dee2e6', marginTop: 4 }}>
              <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>
                {ctxDialog === 'xor' ? 'XOR' : 'Fill'} hex pattern:
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. FF 00"
                  value={fillValue}
                  onChange={(e) => setFillValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFillSubmit();
                    if (e.key === 'Escape') { setCtxMenu(null); setCtxDialog(null); }
                  }}
                  style={{
                    width: 100,
                    padding: '3px 6px',
                    fontSize: 13,
                    border: '1px solid #ced4da',
                    borderRadius: 3,
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleFillSubmit}
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

          <div style={{ borderTop: '1px solid #dee2e6', margin: '4px 0' }} />
          <CtxMenuItem label="Copy" onClick={() => { handleCopy(); setCtxMenu(null); }} />
          <CtxMenuItem label="Paste" onClick={() => { handlePaste(); setCtxMenu(null); }} />
          <CtxMenuItem label="Select All" onClick={() => { setSelection(0, buffer.length - 1); setCtxMenu(null); }} />

          {/* Close button for mobile */}
          {isMobile && (
            <>
              <div style={{ borderTop: '1px solid #dee2e6', margin: '4px 0' }} />
              <CtxMenuItem label="Cancel" onClick={() => { setCtxMenu(null); setCtxDialog(null); }} />
            </>
          )}
        </div>,
        document.body
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#ccc',
    overflow: 'hidden',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
  } as any,
  cursorCanvas: {
    pointerEvents: 'none',
  } as any,
});

export default HexView;
