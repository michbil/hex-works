#import "MenuBarModule.h"

static MenuBarModule *sharedInstance = nil;

@implementation MenuBarModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

- (instancetype)init {
  self = [super init];
  if (self) {
    sharedInstance = self;
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents {
  return @[@"onMenuAction"];
}

+ (void)emitMenuAction:(NSString *)action {
  if (sharedInstance) {
    [sharedInstance sendEventWithName:@"onMenuAction" body:action];
  }
}

RCT_EXPORT_METHOD(setupMenuBar)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [self createMenuBar];
  });
}

- (void)createMenuBar {
  NSMenu *mainMenu = [[NSMenu alloc] init];

  // App menu
  NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
  NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@"Hex Works"];
  [appMenu addItemWithTitle:@"About Hex Works" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
  [appMenu addItem:[NSMenuItem separatorItem]];
  [appMenu addItemWithTitle:@"Quit Hex Works" action:@selector(terminate:) keyEquivalent:@"q"];
  appMenuItem.submenu = appMenu;
  [mainMenu addItem:appMenuItem];

  // File menu
  NSMenuItem *fileMenuItem = [[NSMenuItem alloc] init];
  NSMenu *fileMenu = [[NSMenu alloc] initWithTitle:@"File"];

  NSMenuItem *newItem = [[NSMenuItem alloc] initWithTitle:@"New" action:@selector(menuNew:) keyEquivalent:@"n"];
  newItem.target = self;
  [fileMenu addItem:newItem];

  NSMenuItem *openItem = [[NSMenuItem alloc] initWithTitle:@"Open..." action:@selector(menuOpen:) keyEquivalent:@"o"];
  openItem.target = self;
  [fileMenu addItem:openItem];

  [fileMenu addItem:[NSMenuItem separatorItem]];

  NSMenuItem *saveItem = [[NSMenuItem alloc] initWithTitle:@"Save" action:@selector(menuSave:) keyEquivalent:@"s"];
  saveItem.target = self;
  [fileMenu addItem:saveItem];

  NSMenuItem *saveAsItem = [[NSMenuItem alloc] initWithTitle:@"Save As..." action:@selector(menuSaveAs:) keyEquivalent:@"S"];
  saveAsItem.target = self;
  [fileMenu addItem:saveAsItem];

  [fileMenu addItem:[NSMenuItem separatorItem]];

  NSMenuItem *closeItem = [[NSMenuItem alloc] initWithTitle:@"Close Tab" action:@selector(menuCloseTab:) keyEquivalent:@"w"];
  closeItem.target = self;
  [fileMenu addItem:closeItem];

  fileMenuItem.submenu = fileMenu;
  [mainMenu addItem:fileMenuItem];

  // Edit menu
  NSMenuItem *editMenuItem = [[NSMenuItem alloc] init];
  NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Edit"];

  NSMenuItem *copyItem = [[NSMenuItem alloc] initWithTitle:@"Copy" action:@selector(menuCopy:) keyEquivalent:@"c"];
  copyItem.target = self;
  [editMenu addItem:copyItem];

  NSMenuItem *pasteItem = [[NSMenuItem alloc] initWithTitle:@"Paste" action:@selector(menuPaste:) keyEquivalent:@"v"];
  pasteItem.target = self;
  [editMenu addItem:pasteItem];

  NSMenuItem *selectAllItem = [[NSMenuItem alloc] initWithTitle:@"Select All" action:@selector(menuSelectAll:) keyEquivalent:@"a"];
  selectAllItem.target = self;
  [editMenu addItem:selectAllItem];

  [editMenu addItem:[NSMenuItem separatorItem]];

  NSMenuItem *findItem = [[NSMenuItem alloc] initWithTitle:@"Find..." action:@selector(menuFind:) keyEquivalent:@"f"];
  findItem.target = self;
  [editMenu addItem:findItem];

  editMenuItem.submenu = editMenu;
  [mainMenu addItem:editMenuItem];

  // View menu
  NSMenuItem *viewMenuItem = [[NSMenuItem alloc] init];
  NSMenu *viewMenu = [[NSMenu alloc] initWithTitle:@"View"];

  NSMenuItem *inspectorItem = [[NSMenuItem alloc] initWithTitle:@"Inspector" action:@selector(menuInspector:) keyEquivalent:@"1"];
  inspectorItem.keyEquivalentModifierMask = NSEventModifierFlagCommand;
  inspectorItem.target = self;
  [viewMenu addItem:inspectorItem];

  NSMenuItem *searchItem = [[NSMenuItem alloc] initWithTitle:@"Search" action:@selector(menuSearch:) keyEquivalent:@"2"];
  searchItem.keyEquivalentModifierMask = NSEventModifierFlagCommand;
  searchItem.target = self;
  [viewMenu addItem:searchItem];

  viewMenuItem.submenu = viewMenu;
  [mainMenu addItem:viewMenuItem];

  [NSApp setMainMenu:mainMenu];
}

// Menu action handlers
- (void)menuNew:(id)sender { [MenuBarModule emitMenuAction:@"newFile"]; }
- (void)menuOpen:(id)sender { [MenuBarModule emitMenuAction:@"openFile"]; }
- (void)menuSave:(id)sender { [MenuBarModule emitMenuAction:@"saveFile"]; }
- (void)menuSaveAs:(id)sender { [MenuBarModule emitMenuAction:@"saveFileAs"]; }
- (void)menuCloseTab:(id)sender { [MenuBarModule emitMenuAction:@"closeTab"]; }
- (void)menuCopy:(id)sender { [MenuBarModule emitMenuAction:@"copy"]; }
- (void)menuPaste:(id)sender { [MenuBarModule emitMenuAction:@"paste"]; }
- (void)menuSelectAll:(id)sender { [MenuBarModule emitMenuAction:@"selectAll"]; }
- (void)menuFind:(id)sender { [MenuBarModule emitMenuAction:@"find"]; }
- (void)menuInspector:(id)sender { [MenuBarModule emitMenuAction:@"showInspector"]; }
- (void)menuSearch:(id)sender { [MenuBarModule emitMenuAction:@"showSearch"]; }

@end
