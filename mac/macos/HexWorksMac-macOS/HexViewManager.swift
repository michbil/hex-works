import Foundation
import AppKit

@objc(HexViewManager)
class HexViewManager: RCTViewManager {

  override static func requiresMainQueueSetup() -> Bool { true }

  override func view() -> NSView! {
    return HexViewNative(frame: .zero)
  }
}
