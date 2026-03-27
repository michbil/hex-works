import AppKit
import CoreText

// MARK: - Drawing canvas (non-layer-backed, so draw() works)

private class HexCanvasView: NSView {
  weak var hexView: HexViewNative?

  override var isFlipped: Bool { true }
  override var wantsDefaultClipping: Bool { false }
  override var acceptsFirstResponder: Bool { true }

  override func draw(_ dirtyRect: NSRect) {
    hexView?.drawContent(in: bounds)
  }

  override func keyDown(with event: NSEvent) {
    if event.modifierFlags.contains(.command) {
      // Let Cmd+ shortcuts propagate to menu bar
      super.keyDown(with: event)
    } else {
      hexView?.handleKeyDown(with: event)
    }
  }

  override func mouseDown(with event: NSEvent) {
    hexView?.handleMouseDown(with: event)
  }

  override func mouseDragged(with event: NSEvent) {
    hexView?.handleMouseDragged(with: event)
  }

  override func mouseUp(with event: NSEvent) {
    hexView?.handleMouseUp(with: event)
  }

  override func scrollWheel(with event: NSEvent) {
    hexView?.handleScrollWheel(with: event)
  }
}

// MARK: - React Native wrapper

class HexViewNative: RCTView {

  // MARK: - Props

  @objc var bufferBase64: String = "" { didSet { decodeBuffer(); canvas.needsDisplay = true } }
  @objc var colorBase64: String = "" { didSet { decodeColors(); canvas.needsDisplay = true } }
  @objc var markedBase64: String = "" { didSet { decodeMarked(); canvas.needsDisplay = true } }
  @objc var bufferLength: Int = 0 { didSet { canvas.needsDisplay = true } }
  @objc var cursorPosition: Int = 0 { didSet { canvas.needsDisplay = true } }
  @objc var selectionStart: Int = 0 { didSet { canvas.needsDisplay = true } }
  @objc var selectionEnd: Int = 0 { didSet { canvas.needsDisplay = true } }
  @objc var bytesPerLine: Int = 16 { didSet { canvas.needsDisplay = true } }
  @objc var scrollOffset: Int = 0 { didSet { canvas.needsDisplay = true } }
  @objc var fontSize: CGFloat = 13 { didSet { updateFont(); canvas.needsDisplay = true } }
  @objc var isEditing: Bool = false { didSet { canvas.needsDisplay = true } }
  @objc var editNibble: String = "high" { didSet { canvas.needsDisplay = true } }
  @objc var focused: Bool = true { didSet { canvas.needsDisplay = true } }

  @objc var onBytePress: RCTDirectEventBlock?
  @objc var onSelectionChange: RCTDirectEventBlock?
  @objc var onScroll: RCTDirectEventBlock?
  @objc var onHexKeyDown: RCTDirectEventBlock?
  @objc var onByteEdit: RCTDirectEventBlock?

  // Drag selection state (local, for immediate visual feedback)
  private var dragAnchor: Int = -1
  private var dragSelStart: Int = -1
  private var dragSelEnd: Int = -1
  private var isDragging: Bool = false

  // MARK: - Decoded data

  private var bufferData: Data = Data()
  private var colorData: Data = Data()
  private var markedData: Data = Data()

  // MARK: - Canvas subview

  private let canvas = HexCanvasView()

  // MARK: - Layout

  private var charWidth: CGFloat { fontSize * 0.6 }
  private var lineHeight: CGFloat { fontSize + 4 }
  private var addressWidth: CGFloat { charWidth * 9 }
  private var hexCharWidth: CGFloat { 3 }
  private var gap: CGFloat { charWidth * 2 }

  private var asciiStartX: CGFloat {
    addressWidth + charWidth * CGFloat(bytesPerLine) * hexCharWidth + gap
  }

  private var visibleRows: Int {
    max(1, Int(floor(canvas.bounds.height / lineHeight)))
  }

  private var totalLines: Int {
    guard bufferLength > 0 else { return 0 }
    return (bufferLength + bytesPerLine - 1) / bytesPerLine
  }

  private var startLine: Int {
    guard bytesPerLine > 0 else { return 0 }
    return scrollOffset / bytesPerLine
  }

  // MARK: - Font

  private var nsFont: NSFont!

  // MARK: - Color map

  private static let colorMap: [Int: NSColor] = [
    0: NSColor.clear,
    1: NSColor(red: 0.898, green: 0.451, blue: 0.451, alpha: 1), // #E57373
    2: NSColor(red: 0.502, green: 0.796, blue: 0.769, alpha: 1), // #80CBC4
    3: NSColor(red: 1.000, green: 0.922, blue: 0.231, alpha: 1), // #FFEB3B
    4: NSColor(red: 0.392, green: 0.710, blue: 0.965, alpha: 1), // #64B5F6
    5: NSColor(red: 0.702, green: 0.616, blue: 0.859, alpha: 1), // #B39DDB
    6: NSColor(red: 0.631, green: 0.533, blue: 0.498, alpha: 1), // #A1887F
    7: NSColor(red: 0.620, green: 0.620, blue: 0.620, alpha: 1), // #9E9E9E
  ]

  private static let bgColor = NSColor(red: 0.118, green: 0.118, blue: 0.118, alpha: 1)
  private static let addressColor = NSColor(red: 0.337, green: 0.612, blue: 0.839, alpha: 1)
  private static let textColor = NSColor(red: 0.831, green: 0.831, blue: 0.831, alpha: 1)
  private static let markedTextColor = NSColor(red: 0.957, green: 0.263, blue: 0.212, alpha: 1)
  private static let selectionColor = NSColor(red: 0.678, green: 0.847, blue: 0.902, alpha: 1)
  private static let cursorColor = NSColor(red: 0.267, green: 0.267, blue: 0.600, alpha: 0.5)

  private static let hexChars: [String] = (0..<256).map { String(format: "%02X", $0) }

  // MARK: - Init

  override init(frame: NSRect) {
    super.init(frame: frame)
    setup()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setup()
  }

  private func setup() {
    canvas.hexView = self
    canvas.wantsLayer = false // Important: non-layer-backed so draw() is called
    canvas.autoresizingMask = [.width, .height]
    canvas.frame = bounds
    addSubview(canvas)
    updateFont()
  }

  override func layout() {
    super.layout()
    canvas.frame = bounds
  }

  private func updateFont() {
    nsFont = NSFont(name: "Menlo", size: fontSize)
      ?? NSFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
  }

  // MARK: - Data decoding

  private func decodeBuffer() {
    if let data = Data(base64Encoded: bufferBase64) {
      bufferData = data
    }
  }

  private func decodeColors() {
    if let data = Data(base64Encoded: colorBase64) {
      colorData = data
    }
  }

  private func decodeMarked() {
    if let data = Data(base64Encoded: markedBase64) {
      markedData = data
    }
  }

  // MARK: - Drawing (called from HexCanvasView.draw)

  func drawContent(in rect: NSRect) {
    let width = rect.width
    let height = rect.height

    // Background
    Self.bgColor.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()

    guard bufferData.count > 0, bytesPerLine > 0 else { return }

    // Use local drag state for immediate feedback, fall back to React props
    let selMin: Int
    let selMax: Int
    if isDragging && dragSelStart >= 0 {
      selMin = min(dragSelStart, dragSelEnd)
      selMax = max(dragSelStart, dragSelEnd)
    } else {
      selMin = min(selectionStart, selectionEnd)
      selMax = max(selectionStart, selectionEnd)
    }
    let hasSelection = selMin != selMax

    let cw = charWidth
    let lh = lineHeight
    let addrW = addressWidth

    for row in 0..<visibleRows {
      let lineIndex = startLine + row
      if lineIndex >= totalLines { break }

      let lineOffset = lineIndex * bytesPerLine
      let y = CGFloat(row) * lh

      // Address
      let addr = String(format: "%08X", lineOffset)
      drawText(addr, x: 0, y: y, color: Self.addressColor)

      // Bytes
      let count = min(bytesPerLine, bufferData.count - lineOffset)
      for col in 0..<count {
        let byteIndex = lineOffset + col
        guard byteIndex < bufferData.count else { break }

        let byte = bufferData[byteIndex]
        let colorCode = byteIndex < colorData.count ? Int(colorData[byteIndex]) : 0
        let isMarked = byteIndex < markedData.count && markedData[byteIndex] != 0
        let isCursor = focused && byteIndex == cursorPosition
        let isSelected = hasSelection && byteIndex >= selMin && byteIndex <= selMax

        let hexX = addrW + CGFloat(col) * cw * hexCharWidth
        let asciiX = asciiStartX + CGFloat(col) * cw

        // Check if next byte in row has same highlight (to extend through trailing space)
        let nextByteIndex = byteIndex + 1
        let nextInRow = col + 1 < count
        let nextIsSelected = nextInRow && hasSelection && nextByteIndex >= selMin && nextByteIndex <= selMax
        let nextColorCode = nextInRow && nextByteIndex < colorData.count ? Int(colorData[nextByteIndex]) : 0

        // Background: selection > cursor > color marker
        // Use width 3 chars (including space) if next byte has same bg, else 2 chars only
        if isSelected {
          let hexW = nextIsSelected ? cw * hexCharWidth : cw * 2
          Self.selectionColor.setFill()
          NSRect(x: hexX, y: y, width: hexW, height: lh).fill()
          NSRect(x: asciiX, y: y, width: cw, height: lh).fill()
        } else if isCursor && !hasSelection {
          Self.cursorColor.setFill()
          if editNibble == "high" {
            NSRect(x: hexX, y: y, width: cw, height: lh).fill()
          } else {
            NSRect(x: hexX + cw, y: y, width: cw, height: lh).fill()
          }
          NSRect(x: asciiX, y: y, width: cw, height: lh).fill()
        } else if colorCode > 0, colorCode < 8, let color = Self.colorMap[colorCode] {
          let nextSameColor = nextInRow && nextColorCode == colorCode
          let hexW = nextSameColor ? cw * hexCharWidth : cw * 2
          color.setFill()
          NSRect(x: hexX, y: y, width: hexW, height: lh).fill()
          NSRect(x: asciiX, y: y, width: cw, height: lh).fill()
        }

        // Hex text
        let hexStr = Self.hexChars[Int(byte)]
        let textCol = isMarked ? Self.markedTextColor : Self.textColor
        drawText(hexStr, x: hexX, y: y, color: textCol)

        // ASCII text
        let ch = (byte >= 0x20 && byte <= 0x7E) ? String(UnicodeScalar(byte)) : "."
        drawText(ch, x: asciiX, y: y, color: textCol)
      }
    }

    // Scrollbar
    if totalLines > visibleRows {
      let scrollbarWidth: CGFloat = 10
      let scrollbarX = width - scrollbarWidth

      // Track
      NSColor(white: 0.94, alpha: 1).setFill()
      NSRect(x: scrollbarX, y: 0, width: scrollbarWidth, height: height).fill()

      // Grip
      let gripHeight = max(30, height * CGFloat(visibleRows) / CGFloat(totalLines))
      let maxScrollOffset = max(1, (totalLines - visibleRows) * bytesPerLine)
      let gripTop = (height - gripHeight) * CGFloat(scrollOffset) / CGFloat(maxScrollOffset)

      NSColor(white: 0.67, alpha: 1).setFill()
      NSRect(x: scrollbarX, y: gripTop, width: scrollbarWidth, height: gripHeight).fill()
    }
  }

  private func drawText(_ text: String, x: CGFloat, y: CGFloat, color: NSColor) {
    let attrs: [NSAttributedString.Key: Any] = [
      .font: nsFont as Any,
      .foregroundColor: color,
    ]
    (text as NSString).draw(at: NSPoint(x: x, y: y), withAttributes: attrs)
  }

  // MARK: - Mouse handling

  func handleMouseDown(with event: NSEvent) {
    let loc = canvas.convert(event.locationInWindow, from: nil)
    window?.makeFirstResponder(canvas)

    if let byteInfo = hitTestByte(point: loc) {
      dragAnchor = byteInfo.index
      isDragging = true

      if event.modifierFlags.contains(.shift) {
        dragSelStart = min(byteInfo.index, cursorPosition)
        dragSelEnd = max(byteInfo.index, cursorPosition)
        canvas.needsDisplay = true
        onSelectionChange?(["start": dragSelStart, "end": dragSelEnd, "cursor": byteInfo.index])
      } else {
        dragSelStart = byteInfo.index
        dragSelEnd = byteInfo.index
        canvas.needsDisplay = true
        onBytePress?(["index": byteInfo.index, "isAscii": byteInfo.isAscii])
      }
    }
  }

  func handleMouseDragged(with event: NSEvent) {
    guard dragAnchor >= 0 else { return }
    let loc = canvas.convert(event.locationInWindow, from: nil)
    if let byteInfo = hitTestByte(point: loc) {
      dragSelStart = min(dragAnchor, byteInfo.index)
      dragSelEnd = max(dragAnchor, byteInfo.index)
      canvas.needsDisplay = true
      onSelectionChange?(["start": dragSelStart, "end": dragSelEnd, "cursor": byteInfo.index])
    }
  }

  func handleMouseUp(with event: NSEvent) {
    if dragAnchor >= 0 {
      let loc = canvas.convert(event.locationInWindow, from: nil)
      if let byteInfo = hitTestByte(point: loc) {
        dragSelStart = min(dragAnchor, byteInfo.index)
        dragSelEnd = max(dragAnchor, byteInfo.index)
        onSelectionChange?(["start": dragSelStart, "end": dragSelEnd, "cursor": byteInfo.index])
      }
    }
    isDragging = false
    dragAnchor = -1
  }

  private func hitTestByte(point: NSPoint) -> (index: Int, isAscii: Bool)? {
    let cw = charWidth
    let lh = lineHeight
    let row = Int(floor(point.y / lh))
    let lineIndex = startLine + row
    guard lineIndex >= 0, lineIndex < totalLines else { return nil }
    let lineOffset = lineIndex * bytesPerLine
    let x = point.x

    if x >= asciiStartX {
      let col = Int(floor((x - asciiStartX) / cw))
      guard col >= 0, col < bytesPerLine else { return nil }
      let index = lineOffset + col
      guard index < bufferData.count else { return nil }
      return (index: index, isAscii: true)
    } else if x >= addressWidth {
      let col = Int(floor((x - addressWidth) / (cw * hexCharWidth)))
      guard col >= 0, col < bytesPerLine else { return nil }
      let index = lineOffset + col
      guard index < bufferData.count else { return nil }
      return (index: index, isAscii: false)
    }

    return nil
  }

  // MARK: - Scroll handling

  func handleScrollWheel(with event: NSEvent) {
    let delta = event.scrollingDeltaY
    let lineDelta = delta > 0 ? -3 : (delta < 0 ? 3 : 0)
    let newOffset = max(0, scrollOffset + lineDelta * bytesPerLine)
    let maxOffset = max(0, (totalLines - visibleRows) * bytesPerLine)
    let clampedOffset = min(newOffset, maxOffset)
    onScroll?(["offset": clampedOffset])
  }

  // MARK: - Keyboard handling

  func handleKeyDown(with event: NSEvent) {
    let key: String
    switch event.keyCode {
    case 123: key = "ArrowLeft"
    case 124: key = "ArrowRight"
    case 125: key = "ArrowDown"
    case 126: key = "ArrowUp"
    case 115: key = "Home"
    case 119: key = "End"
    case 116: key = "PageUp"
    case 121: key = "PageDown"
    case 48:  key = "Tab"
    default:
      if let chars = event.charactersIgnoringModifiers, !chars.isEmpty {
        key = chars.lowercased()
      } else {
        return
      }
    }

    let shift = event.modifierFlags.contains(.shift)
    let meta = event.modifierFlags.contains(.command)

    if meta {
      // Let Cmd+ shortcuts bubble up to menu bar
      return
    }

    onHexKeyDown?(["key": key, "shift": shift, "meta": meta])
  }
}
