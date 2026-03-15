/**
 * HexView Component - Canvas-based hex editor view
 * Ported from AngularJS hex-works app
 */

import React, { useRef, useEffect, useEffectEvent, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { createPortal } from "react-dom";
import { useHexEditorStore } from "../../contexts/hex-editor-store";
import {
  byteToHex,
  addressToHex,
  byteToChar,
  stringToByteSeq,
} from "../../utils/helpers";

// Color map for byte highlighting
const COLOR_MAP: Record<number, string> = {
  0: "#ffffff",
  1: "#E57373", // Red
  2: "#80CBC4", // Teal
  3: "#FFEB3B", // Yellow
  4: "#64B5F6", // Blue
  5: "#B39DDB", // Purple
  6: "#A1887F", // Brown
  7: "#9E9E9E", // Grey
  8: "#ADD8E6", // Light blue (selection)
};

function CtxMenuItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        color: "#212529",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "#e9ecef";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      {label}
    </div>
  );
}

export function HexView({ bytesPerLine }: { bytesPerLine: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<View>(null);

  const fontSize = 14;
  const fontFamily = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "Consolas, Monaco, monospace",
  })!;

  const [_dimensions, setDimensions] = useState({
    height: 400,
  });

  const dimensions = {
    width: bytesPerLine == 16 ? 800 : 380,
    height: _dimensions.height,
  };

  const [focused, setFocused] = useState(false);
  const [textMode, setTextMode] = useState(false);

  // Scrollbar drag state
  const scrollbarGripRef = useRef(false);
  const scrollbarDragOffsetRef = useRef(0);
  const scrollbarParamsRef = useRef<{ top: number; height: number } | null>(
    null,
  );

  // Touch state
  const touchStartRef = useRef<{
    x: number;
    y: number;
    scrollOffset: number;
    time: number;
  } | null>(null);
  const touchMovedRef = useRef(false);

  // Get device pixel ratio for sharp rendering on high-DPI displays
  const dpr = Platform.OS === "web" ? window.devicePixelRatio || 1 : 1;

  const {
    buffer,
    cursorPosition,
    scrollOffset,
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
  } = useHexEditorStore();

  // Calculate layout metrics
  const SCROLLBAR_WIDTH = 10;
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
    if (Platform.OS !== "web") return;

    const el = containerRef.current as unknown as HTMLElement;
    if (!el) return;

    const measure = () => {
      // Use clientWidth/clientHeight which gives the inner content box
      const w = el.clientWidth;
      const h = el.clientHeight;
      console.log("Measured dimensions:", { w, h });
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    };

    // Use ResizeObserver for responsive sizing
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => measure());
      ro.observe(el);
      // Defer initial measure to after layout
      requestAnimationFrame(measure);
      return () => ro.disconnect();
    }

    requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Get background color for a byte
  const getByteBackground = (index: number): string => {
    if (!buffer) return COLOR_MAP[0];

    // Selection has priority
    const selStart = Math.min(selection.start, selection.end);
    const selEnd = Math.max(selection.start, selection.end);
    if (index >= selStart && index <= selEnd && selStart !== selEnd) {
      return "#999999";
    }

    // Then colors from buffer (use master tab's buffer if set)
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
    if (totalLines <= visibleRows) return null; // No scrollbar needed

    const maxOffset = Math.max(0, (totalLines - visibleRows) * bytesPerLine);
    const canvasHeight = dimensions.height;
    let gripHeight = (canvasHeight * visibleRows) / totalLines;
    if (gripHeight < 30) gripHeight = 30; // Minimum grip height

    const gripTop =
      maxOffset > 0
        ? ((canvasHeight - gripHeight) * scrollOffset) / maxOffset
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
    let offset = Math.round((maxOffset * ratio) / bytesPerLine) * bytesPerLine;
    if (offset < 0) offset = 0;
    if (offset > maxOffset) offset = maxOffset;
    return offset;
  };

  // Render the hex view on canvas
  const renderCanvas = () => {
    if (Platform.OS !== "web") return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !buffer) return;

    // Scale canvas for high-DPI displays
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Set font with proper rendering hints
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "bottom";
    ctx.imageSmoothingEnabled = false;

    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const bufferLength = buffer.length;

    for (let row = 0; row < visibleRows; row++) {
      const lineOffset = (startLine + row) * bytesPerLine;
      if (lineOffset >= bufferLength) break;

      const y = (row + 1) * lineHeight;

      // Draw address column
      ctx.fillStyle = "#0000FF";
      ctx.fillText(addressToHex(lineOffset, 8), 0, y);

      // Draw hex values and ASCII
      let hexX = addressWidth;
      let asciiX = addressWidth + charWidth * bytesPerLine * hexCharWidth + gap;

      for (let col = 0; col < bytesPerLine; col++) {
        const byteIndex = lineOffset + col;
        if (byteIndex >= bufferLength) break;

        const byte = buffer.getByte(byteIndex);
        const bg = getByteBackground(byteIndex);
        const marked = isMarked(byteIndex);

        // Draw hex background (include trailing space if present)
        if (bg !== "#ffffff") {
          ctx.fillStyle = bg;
          ctx.fillRect(
            hexX,
            y - lineHeight + 2,
            charWidth * hexCharWidth,
            lineHeight,
          );
          ctx.fillRect(asciiX, y - lineHeight + 2, charWidth, lineHeight);
        }

        // Draw hex value
        ctx.fillStyle = marked ? "#F44336" : "#000000";
        ctx.fillText(byteToHex(byte), hexX, y);

        // Draw ASCII char
        ctx.fillText(byteToChar(byte), asciiX, y);

        hexX += charWidth * hexCharWidth;
        asciiX += charWidth;
      }
    }

    // Draw scrollbar on main canvas
    const sbParams = getScrollbarParams();
    scrollbarParamsRef.current = sbParams;
    if (sbParams) {
      // Track background
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(scrollbarX, 0, SCROLLBAR_WIDTH, dimensions.height);
      // Grip
      ctx.fillStyle = "#aaaaaa";
      ctx.fillRect(scrollbarX, sbParams.top, SCROLLBAR_WIDTH, sbParams.height);
    }
  };

  // Render cursor
  const renderCanvasCursor = () => {
    if (Platform.OS !== "web") return;

    const canvas = cursorCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !buffer) return;

    // Scale canvas for high-DPI displays
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (!focused) return;

    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const cursorLine = Math.floor(cursorPosition / bytesPerLine);
    const cursorCol = cursorPosition % bytesPerLine;

    // Check if cursor is visible
    if (cursorLine < startLine || cursorLine >= startLine + visibleRows) return;

    const row = cursorLine - startLine;
    const y = (row + 1) * lineHeight;

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#449";

    if (textMode) {
      // Cursor in ASCII area
      const asciiX =
        addressWidth +
        charWidth * bytesPerLine * hexCharWidth +
        gap +
        cursorCol * charWidth;
      ctx.fillRect(asciiX, y - lineHeight + 2, charWidth, lineHeight);
    } else {
      // Cursor in hex area
      const hexX = addressWidth + cursorCol * charWidth * hexCharWidth;
      const nibbleOffset = editNibble === "low" ? charWidth : 0;
      ctx.fillRect(
        hexX + nibbleOffset,
        y - lineHeight + 2,
        charWidth,
        lineHeight,
      );
    }
  };

  // Re-render when state changes
  useEffect(() => {
    renderCanvas();
    renderCanvasCursor();
    console.log("Canvas rendered with scrollOffset:", scrollOffset);
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
    if (Platform.OS !== "web") return;

    const handleGlobalMouseUp = () => {
      scrollbarGripRef.current = false;
    };

    window.addEventListener("mousemove", onScrollbarDrag);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", onScrollbarDrag);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Mouse event handlers
  const handleMouseEvent = (
    event: React.MouseEvent<HTMLCanvasElement>,
    eventType: "down" | "up" | "move",
  ) => {
    if (!buffer) return;
    // Ignore right-click so selection is preserved for context menu
    if (event.button === 2) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Scrollbar interaction
    if (x > scrollbarX - 5) {
      if (eventType === "down") {
        const sbParams = scrollbarParamsRef.current;
        if (sbParams) {
          if (y >= sbParams.top && y <= sbParams.top + sbParams.height) {
            // Grabbed the grip — store offset from grip top for smooth drag
            scrollbarGripRef.current = true;
            scrollbarDragOffsetRef.current = sbParams.top - y;
          } else {
            // Clicked in scrollbar track above/below grip — jump to position
            scrollbarGripRef.current = true;
            scrollbarDragOffsetRef.current = -(sbParams.height / 2);
            const offset = reverseScrollCompute(
              y + scrollbarDragOffsetRef.current,
            );
            setScrollOffset(offset);
          }
        }
      }
      return; // Don't process as hex/ascii click
    }

    // If scrollbar is being dragged, ignore other mouse events
    if (scrollbarGripRef.current) return;

    const row = Math.floor(y / lineHeight);
    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const lineOffset = (startLine + row) * bytesPerLine;

    // Determine if click is in hex or ASCII area
    let col = -1;
    let isAscii = false;

    const hexEnd = addressWidth + charWidth * bytesPerLine * hexCharWidth;
    const asciiStart = hexEnd + gap;

    if (x >= addressWidth && x < hexEnd) {
      // Hex area
      col = Math.floor((x - addressWidth) / (charWidth * hexCharWidth));
      isAscii = false;
    } else if (x >= asciiStart) {
      // ASCII area
      col = Math.floor((x - asciiStart) / charWidth);
      isAscii = true;
    }

    if (col < 0 || col >= bytesPerLine) return;

    const byteIndex = lineOffset + col;
    if (byteIndex < 0 || byteIndex >= buffer.length) return;

    if (eventType === "down") {
      setTextMode(isAscii);
      setCursorPosition(byteIndex);
      setIsEditing(true);

      // Handle nibble selection in hex mode
      if (!isAscii) {
        const hexX = addressWidth + col * charWidth * hexCharWidth;
        const relX = x - hexX;
        setEditNibble(relX < charWidth ? "high" : "low");
      }

      // Start selection
      setSelection(byteIndex, byteIndex);
    } else if (eventType === "move" && event.buttons === 1) {
      // Drag to extend selection
      setSelection(selection.start, byteIndex);
    }
  };

  // Wheel handler for scrolling
  // Attach wheel listener with { passive: false } to allow preventDefault
  const onWheel = useEffectEvent((event: WheelEvent) => {
    if (!buffer) return;
    event.preventDefault();

    const delta = Math.sign(event.deltaY) * bytesPerLine * 3;
    const totalLines = Math.ceil(buffer.length / bytesPerLine);
    const maxOffset = Math.max(0, (totalLines - visibleRows) * bytesPerLine);
    const newOffset = Math.max(0, Math.min(maxOffset, scrollOffset + delta));

    setScrollOffset(newOffset);
  });

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  // Touch handlers for mobile scrolling and tap-to-position
  const onTouchStart = useEffectEvent((e: TouchEvent) => {
    if (!buffer) return;
    e.preventDefault(); // Prevent page scroll
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      scrollOffset,
      time: Date.now(),
    };
    touchMovedRef.current = false;
  });

  const onTouchMove = useEffectEvent((e: TouchEvent) => {
    if (!buffer || !touchStartRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const dy = touchStartRef.current.y - touch.clientY;

    // Mark as moved if dragged more than a few pixels
    if (
      Math.abs(dy) > 5 ||
      Math.abs(touch.clientX - touchStartRef.current.x) > 5
    ) {
      touchMovedRef.current = true;
    }

    // Scroll: convert pixel delta to line-based offset
    const lineDelta = Math.round(dy / lineHeight) * bytesPerLine;
    const totalLines = Math.ceil(buffer.length / bytesPerLine);
    const maxOffset = Math.max(0, (totalLines - visibleRows) * bytesPerLine);
    const newOffset = Math.max(
      0,
      Math.min(maxOffset, touchStartRef.current.scrollOffset + lineDelta),
    );
    setScrollOffset(newOffset);
  });

  const onTouchEnd = useEffectEvent((e: TouchEvent) => {
    if (!buffer || !touchStartRef.current) return;
    e.preventDefault();

    // If the user didn't drag, treat as a tap to position cursor
    if (!touchMovedRef.current) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = touchStartRef.current.x - rect.left;
      const y = touchStartRef.current.y - rect.top;

      const row = Math.floor(y / lineHeight);
      const startLine = Math.floor(scrollOffset / bytesPerLine);
      const lineOffset = (startLine + row) * bytesPerLine;

      let col = -1;
      let isAscii = false;
      const hexEnd = addressWidth + charWidth * bytesPerLine * hexCharWidth;
      const asciiStart = hexEnd + gap;

      if (x >= addressWidth && x < hexEnd) {
        col = Math.floor((x - addressWidth) / (charWidth * hexCharWidth));
      } else if (x >= asciiStart) {
        col = Math.floor((x - asciiStart) / charWidth);
        isAscii = true;
      }

      if (col >= 0 && col < bytesPerLine) {
        const byteIndex = lineOffset + col;
        if (byteIndex >= 0 && byteIndex < buffer.length) {
          setTextMode(isAscii);
          setCursorPosition(byteIndex);
          setIsEditing(true);
          setSelection(byteIndex, byteIndex);
          if (!isAscii) {
            const hexX = addressWidth + col * charWidth * hexCharWidth;
            const relX = x - hexX;
            setEditNibble(relX < charWidth ? "high" : "low");
          }
          // Focus the canvas so keyboard input works after tap
          canvas.focus();
        }
      }
    }

    touchStartRef.current = null;
  });

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

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
    const text = hexParts.join(" ");
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: textarea copy
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
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
      return; // No clipboard access
    }
    // Parse pasted text as hex bytes (supports "AA BB CC" or "AABBCC" or "AA:BB:CC")
    const cleaned = text.replace(/[^0-9a-fA-F]/g, "");
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
    setSelection(
      cursorPosition,
      Math.min(cursorPosition + bytes.length - 1, buffer.length - 1),
    );
  };

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [ctxDialog, setCtxDialog] = useState<"fill" | "xor" | null>(null);
  const [fillValue, setFillValue] = useState("");

  // Attach native contextmenu to canvas (RN Web swallows it otherwise)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener("contextmenu", handler);
    return () => el.removeEventListener("contextmenu", handler);
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu || Platform.OS !== "web") return;
    const close = () => {
      setCtxMenu(null);
      setCtxDialog(null);
    };
    const id = setTimeout(() => window.addEventListener("mousedown", close), 0);
    return () => {
      clearTimeout(id);
      window.removeEventListener("mousedown", close);
    };
  }, [ctxMenu]);

  const handleFillSubmit = () => {
    const seq = stringToByteSeq(fillValue);
    if (seq.length > 0) {
      fillSelection(seq, ctxDialog === "xor");
    }
    setCtxMenu(null);
    setCtxDialog(null);
    setFillValue("");
  };

  // Keyboard handler
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!buffer) return;

    const { key, shiftKey, ctrlKey, metaKey } = event;
    const mod = ctrlKey || metaKey;

    // Clipboard / selection shortcuts
    if (mod && key.toLowerCase() === "c") {
      event.preventDefault();
      handleCopy();
      return;
    }
    if (mod && key.toLowerCase() === "v") {
      event.preventDefault();
      handlePaste();
      return;
    }
    if (mod && key.toLowerCase() === "a") {
      event.preventDefault();
      setSelection(0, buffer.length - 1);
      return;
    }

    let newPosition = cursorPosition;
    let d = 0;

    // Navigation
    switch (key) {
      case "ArrowLeft":
        if (!textMode && editNibble === "low") {
          setEditNibble("high");
        } else {
          setEditNibble("low");
          d = -1;
        }
        break;
      case "ArrowRight":
        if (!textMode && editNibble === "high") {
          setEditNibble("low");
        } else {
          setEditNibble("high");
          d = 1;
        }
        break;
      case "ArrowUp":
        d = -bytesPerLine;
        break;
      case "ArrowDown":
        d = bytesPerLine;
        break;
      case "PageUp":
        d = -bytesPerLine * visibleRows;
        break;
      case "PageDown":
        d = bytesPerLine * visibleRows;
        break;
      case "Home":
        newPosition =
          ctrlKey || metaKey
            ? 0
            : Math.floor(cursorPosition / bytesPerLine) * bytesPerLine;
        d = newPosition - cursorPosition;
        break;
      case "End":
        newPosition =
          ctrlKey || metaKey
            ? buffer.length - 1
            : Math.floor(cursorPosition / bytesPerLine) * bytesPerLine +
              bytesPerLine -
              1;
        d = newPosition - cursorPosition;
        break;
      default:
        // Handle hex input
        if (isEditing && !textMode) {
          const hexMatch = key.match(/^[0-9a-fA-F]$/);
          if (hexMatch) {
            event.preventDefault();
            const digit = parseInt(key, 16);
            const currentByte = buffer.getByte(cursorPosition);

            if (editNibble === "high") {
              const newByte = (digit << 4) | (currentByte & 0x0f);
              setByte(cursorPosition, newByte);
              setEditNibble("low");
            } else {
              const newByte = (currentByte & 0xf0) | digit;
              setByte(cursorPosition, newByte);
              setEditNibble("high");
              d = 1;
            }
          } else {
            return; // Not a hex key, ignore
          }
        } else if (isEditing && textMode) {
          // ASCII input
          if (
            key.length === 1 &&
            key.charCodeAt(0) >= 0x20 &&
            key.charCodeAt(0) < 0x7f
          ) {
            event.preventDefault();
            setByte(cursorPosition, key.charCodeAt(0));
            d = 1;
          } else {
            return; // Not a printable character, ignore
          }
        } else {
          return; // Not in editing mode
        }
        break;
    }

    event.preventDefault();

    // Apply movement
    newPosition = cursorPosition + d;
    newPosition = Math.max(0, Math.min(buffer.length - 1, newPosition));
    setCursorPosition(newPosition);

    // Update selection
    if (shiftKey) {
      setSelection(selection.start, newPosition);
    } else {
      setSelection(newPosition, newPosition);
    }

    // Adjust scroll if needed
    const cursorLine = Math.floor(newPosition / bytesPerLine);
    const startLine = Math.floor(scrollOffset / bytesPerLine);
    const endLine = startLine + visibleRows - 1;

    if (cursorLine < startLine) {
      setScrollOffset(cursorLine * bytesPerLine);
    } else if (cursorLine > endLine) {
      setScrollOffset((cursorLine - visibleRows + 1) * bytesPerLine);
    }
  };

  if (Platform.OS !== "web") {
    // For native, we'd need a different approach (react-native-canvas or custom native view)
    return (
      <View style={styles.container}>
        {/* Native implementation placeholder */}
      </View>
    );
  }

  console.log({ w: dimensions.width, h: dimensions.height });

  return (
    <View ref={containerRef} style={[styles.container, { width: dimensions.width }]}>
      <canvas
        ref={canvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{
          ...(styles.canvas as object),
          width: dimensions.width,
          height: dimensions.height,
          touchAction: "none",
        }}
        tabIndex={0}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onMouseDown={(e) => handleMouseEvent(e, "down")}
        onMouseUp={(e) => handleMouseEvent(e, "up")}
        onMouseMove={(e) => handleMouseEvent(e, "move")}
        onKeyDown={handleKeyDown}
      />
      <canvas
        ref={cursorCanvasRef}
        width={dimensions.width * dpr}
        height={dimensions.height * dpr}
        style={{
          ...(styles.canvas as object),
          ...(styles.cursorCanvas as object),
          width: dimensions.width,
          height: dimensions.height,
        }}
      />

      {/* Editor Context Menu */}
      {ctxMenu &&
        buffer &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: ctxMenu.x,
              top: ctxMenu.y,
              backgroundColor: "#ffffff",
              border: "1px solid #ced4da",
              borderRadius: 4,
              paddingTop: 4,
              paddingBottom: 4,
              minWidth: 180,
              boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
              zIndex: 10000,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CtxMenuItem
              label="Clear markers"
              onClick={() => {
                clearMarkers();
                setCtxMenu(null);
              }}
            />
            <CtxMenuItem
              label="Swap bytes"
              onClick={() => {
                swapBytes();
                setCtxMenu(null);
              }}
            />
            <CtxMenuItem
              label="FILL..."
              onClick={() => {
                setCtxDialog("fill");
                setFillValue("");
              }}
            />
            <CtxMenuItem
              label="XOR..."
              onClick={() => {
                setCtxDialog("xor");
                setFillValue("");
              }}
            />

            {ctxDialog && (
              <div
                style={{
                  padding: "4px 12px",
                  borderTop: "1px solid #dee2e6",
                  marginTop: 4,
                }}
              >
                <div
                  style={{ fontSize: 12, color: "#6c757d", marginBottom: 4 }}
                >
                  {ctxDialog === "xor" ? "XOR" : "Fill"} hex pattern:
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. FF 00"
                    value={fillValue}
                    onChange={(e) => setFillValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFillSubmit();
                      if (e.key === "Escape") {
                        setCtxMenu(null);
                        setCtxDialog(null);
                      }
                    }}
                    style={{
                      width: 100,
                      padding: "3px 6px",
                      fontSize: 13,
                      border: "1px solid #ced4da",
                      borderRadius: 3,
                      outline: "none",
                      fontFamily: "monospace",
                    }}
                  />
                  <button
                    onClick={handleFillSubmit}
                    style={{
                      padding: "3px 10px",
                      fontSize: 12,
                      backgroundColor: "#007bff",
                      color: "#fff",
                      border: "none",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            <div style={{ borderTop: "1px solid #dee2e6", margin: "4px 0" }} />
            <CtxMenuItem
              label="Copy"
              onClick={() => {
                handleCopy();
                setCtxMenu(null);
              }}
            />
            <CtxMenuItem
              label="Paste"
              onClick={() => {
                handlePaste();
                setCtxMenu(null);
              }}
            />
            <CtxMenuItem
              label="Select All"
              onClick={() => {
                setSelection(0, buffer.length - 1);
                setCtxMenu(null);
              }}
            />
          </div>,
          document.body,
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ccc",
    overflow: "hidden",
  },
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
  } as any,
  cursorCanvas: {
    pointerEvents: "none",
  } as any,
});

export default HexView;
