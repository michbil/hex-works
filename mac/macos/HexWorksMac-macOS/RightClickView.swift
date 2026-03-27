import AppKit

@objc(RightClickViewManager)
class RightClickViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool { true }

  override func view() -> NSView! {
    return RightClickView(frame: .zero)
  }
}

class RightClickView: RCTView {
  @objc var onRightClick: RCTDirectEventBlock?

  private let interceptor = RightClickInterceptor()

  override init(frame: NSRect) {
    super.init(frame: frame)
    interceptor.parent = self
    interceptor.autoresizingMask = [.width, .height]
    interceptor.frame = bounds
    addSubview(interceptor)
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }

  override func layout() {
    super.layout()
    interceptor.frame = bounds
  }
}

private class RightClickInterceptor: NSView {
  weak var parent: RightClickView?

  override func rightMouseDown(with event: NSEvent) {
    parent?.onRightClick?([:])
  }

  // Pass left-click through to React
  override func mouseDown(with event: NSEvent) {
    super.mouseDown(with: event)
  }

  override func hitTest(_ point: NSPoint) -> NSView? {
    // Only intercept right-clicks; return nil for left-clicks so React handles them
    let event = NSApp.currentEvent
    if event?.type == .rightMouseDown {
      return self
    }
    return nil
  }
}
