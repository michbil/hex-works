import AppKit

@objc(ToolbarManager)
class ToolbarManager: NSObject, NSToolbarDelegate {

  @objc static let shared = ToolbarManager()

  private let toolbarIdentifier = NSToolbar.Identifier("HexWorksToolbar")

  private enum Item: String, CaseIterable {
    case newFile = "NewFile"
    case openFile = "OpenFile"
    case saveFile = "SaveFile"

    var label: String {
      switch self {
      case .newFile: return "New"
      case .openFile: return "Open"
      case .saveFile: return "Save"
      }
    }

    var icon: NSImage.Name {
      switch self {
      case .newFile: return NSImage.addTemplateName
      case .openFile: return NSImage.folderName
      case .saveFile: return NSImage.Name("NSToolbarSaveTemplate")
      }
    }

    var menuAction: String {
      switch self {
      case .newFile: return "newFile"
      case .openFile: return "openFile"
      case .saveFile: return "saveFile"
      }
    }
  }

  @objc func setupToolbar() {
    DispatchQueue.main.async {
      guard let window = NSApp.mainWindow else { return }

      let toolbar = NSToolbar(identifier: self.toolbarIdentifier)
      toolbar.delegate = self
      toolbar.displayMode = .iconAndLabel
      toolbar.allowsUserCustomization = false
      toolbar.centeredItemIdentifiers = Set(Item.allCases.map { NSToolbarItem.Identifier($0.rawValue) })
      window.toolbar = toolbar
      window.titleVisibility = .visible
    }
  }

  // MARK: - NSToolbarDelegate

  func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
    return [
      NSToolbarItem.Identifier(Item.newFile.rawValue),
      NSToolbarItem.Identifier(Item.openFile.rawValue),
      NSToolbarItem.Identifier(Item.saveFile.rawValue),
      .flexibleSpace,
    ]
  }

  func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
    return toolbarDefaultItemIdentifiers(toolbar)
  }

  func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
    guard let item = Item(rawValue: itemIdentifier.rawValue) else { return nil }

    let toolbarItem = NSToolbarItem(itemIdentifier: itemIdentifier)
    toolbarItem.label = item.label
    toolbarItem.toolTip = item.label
    toolbarItem.target = self
    toolbarItem.action = #selector(toolbarItemClicked(_:))

    // Use SF Symbols on macOS 11+
    if let sfImage = NSImage(systemSymbolName: sfSymbol(for: item), accessibilityDescription: item.label) {
      toolbarItem.image = sfImage
    } else {
      toolbarItem.image = NSImage(named: item.icon)
    }

    return toolbarItem
  }

  private func sfSymbol(for item: Item) -> String {
    switch item {
    case .newFile: return "doc.badge.plus"
    case .openFile: return "folder"
    case .saveFile: return "square.and.arrow.down"
    }
  }

  @objc private func toolbarItemClicked(_ sender: NSToolbarItem) {
    guard let item = Item(rawValue: sender.itemIdentifier.rawValue) else { return }
    MenuBarModule.emitMenuAction(item.menuAction)
  }
}
