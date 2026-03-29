#import "FileDialogModule.h"
#import <AppKit/AppKit.h>
#import <React/RCTUtils.h>

@implementation FileDialogModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(openFile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.canChooseFiles = YES;
    panel.canChooseDirectories = NO;
    panel.allowsMultipleSelection = YES;
    panel.message = @"Select binary files to open";

    [panel beginWithCompletionHandler:^(NSModalResponse result) {
      if (result != NSModalResponseOK || panel.URLs.count == 0) {
        resolve([NSNull null]);
        return;
      }

      NSMutableArray *files = [NSMutableArray new];
      for (NSURL *url in panel.URLs) {
        NSError *error = nil;
        NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&error];
        if (error) continue;

        // Create security-scoped bookmark for persistent access
        NSError *bookmarkError = nil;
        NSData *bookmark = [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                          includingResourceValuesForKeys:nil
                                         relativeToURL:nil
                                                 error:&bookmarkError];
        NSString *bookmarkBase64 = bookmark ? [bookmark base64EncodedStringWithOptions:0] : @"";
        if (bookmarkError) {
          NSLog(@"HexWorks: bookmark creation failed for %@: %@", url.path, bookmarkError);
        }

        NSString *filePath = url.path;
        NSLog(@"HexWorks: opened file path=%@ bookmark=%lu bytes", filePath, (unsigned long)bookmark.length);

        [files addObject:@{
          @"name": url.lastPathComponent ?: @"",
          @"path": filePath ?: @"",
          @"data": [data base64EncodedStringWithOptions:0] ?: @"",
          @"size": @(data.length),
          @"bookmark": bookmarkBase64,
        }];
      }

      if (files.count == 0) {
        reject(@"READ_ERROR", @"Failed to read selected files", nil);
        return;
      }

      resolve(files);
    }];
  });
}

RCT_EXPORT_METHOD(saveFile:(NSString *)suggestedName
                  data:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSSavePanel *panel = [NSSavePanel savePanel];
    panel.nameFieldStringValue = suggestedName ?: @"untitled.bin";
    panel.message = @"Save binary file";

    [panel beginWithCompletionHandler:^(NSModalResponse result) {
      if (result != NSModalResponseOK || panel.URL == nil) {
        resolve([NSNull null]);
        return;
      }

      NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
      if (!data) {
        reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
        return;
      }

      NSError *error = nil;
      [data writeToURL:panel.URL options:NSDataWritingAtomic error:&error];
      if (error) {
        reject(@"WRITE_ERROR", error.localizedDescription, error);
        return;
      }

      resolve(@{
        @"path": panel.URL.path ?: @"",
        @"name": panel.URL.lastPathComponent ?: @"",
      });
    }];
  });
}

RCT_EXPORT_METHOD(saveFileToPath:(NSString *)filePath
                  data:(NSString *)base64Data
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSData *data = [[NSData alloc] initWithBase64EncodedString:base64Data options:0];
  if (!data) {
    reject(@"DECODE_ERROR", @"Failed to decode base64 data", nil);
    return;
  }

  NSError *error = nil;
  NSURL *url = [NSURL fileURLWithPath:filePath];
  [data writeToURL:url options:NSDataWritingAtomic error:&error];
  if (error) {
    reject(@"WRITE_ERROR", error.localizedDescription, error);
    return;
  }

  resolve(@{
    @"path": filePath,
    @"name": url.lastPathComponent ?: @"",
  });
}

RCT_EXPORT_METHOD(setWindowTitle:(NSString *)title)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSApp.mainWindow.title = title ?: @"Hex Works";
  });
}

RCT_EXPORT_METHOD(showContextMenu:(NSArray *)items
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSMenu *menu = [[NSMenu alloc] initWithTitle:@""];
    menu.autoenablesItems = NO;

    __block NSString *selectedAction = nil;

    for (NSUInteger i = 0; i < items.count; i++) {
      NSDictionary *item = items[i];
      NSString *label = item[@"label"];
      NSString *action = item[@"action"];
      if ([label isEqualToString:@"---"]) {
        [menu addItem:[NSMenuItem separatorItem]];
      } else {
        NSMenuItem *menuItem = [[NSMenuItem alloc] initWithTitle:label action:@selector(contextMenuItemClicked:) keyEquivalent:@""];
        menuItem.target = self;
        menuItem.tag = i;
        menuItem.representedObject = action;
        menuItem.enabled = YES;
        [menu addItem:menuItem];
      }
    }

    NSWindow *window = NSApp.mainWindow;
    if (window) {
      NSPoint mouseLoc = [NSEvent mouseLocation];
      NSPoint windowPoint = [window convertPointFromScreen:mouseLoc];
      NSView *contentView = window.contentView;
      NSPoint viewPoint = [contentView convertPoint:windowPoint fromView:nil];

      // Store resolve block for callback
      self.contextMenuResolve = resolve;
      self.contextMenuResolved = NO;

      [menu popUpMenuPositioningItem:nil atLocation:viewPoint inView:contentView];

      // If nothing was selected (menu dismissed)
      if (!self.contextMenuResolved) {
        resolve([NSNull null]);
      }
      self.contextMenuResolve = nil;
    } else {
      resolve([NSNull null]);
    }
  });
}

- (void)contextMenuItemClicked:(NSMenuItem *)sender {
  if (self.contextMenuResolve && sender.representedObject) {
    self.contextMenuResolve(sender.representedObject);
    self.contextMenuResolved = YES;
  }
}

RCT_EXPORT_METHOD(showInputAlert:(NSString *)title
                  message:(NSString *)message
                  defaultValue:(NSString *)defaultValue
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = title;
    alert.informativeText = message;
    [alert addButtonWithTitle:@"OK"];
    [alert addButtonWithTitle:@"Cancel"];

    NSTextField *input = [[NSTextField alloc] initWithFrame:NSMakeRect(0, 0, 200, 24)];
    input.stringValue = defaultValue ?: @"";
    alert.accessoryView = input;

    NSModalResponse response = [alert runModal];
    if (response == NSAlertFirstButtonReturn) {
      resolve(input.stringValue);
    } else {
      resolve([NSNull null]);
    }
  });
}

RCT_EXPORT_METHOD(copyToClipboard:(NSString *)text)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSPasteboard *pb = [NSPasteboard generalPasteboard];
    [pb clearContents];
    [pb setString:text forType:NSPasteboardTypeString];
  });
}

RCT_EXPORT_METHOD(pasteFromClipboard:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSPasteboard *pb = [NSPasteboard generalPasteboard];
    NSString *text = [pb stringForType:NSPasteboardTypeString];
    resolve(text ?: @"");
  });
}

// Read file from bookmark (security-scoped) or path
RCT_EXPORT_METHOD(readFileFromBookmark:(NSString *)bookmarkBase64
                  fallbackPath:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = nil;
  BOOL isStale = NO;

  // Try security-scoped bookmark first
  if (bookmarkBase64.length > 0) {
    NSData *bookmarkData = [[NSData alloc] initWithBase64EncodedString:bookmarkBase64 options:0];
    if (bookmarkData) {
      NSError *bookmarkError = nil;
      url = [NSURL URLByResolvingBookmarkData:bookmarkData
                                      options:NSURLBookmarkResolutionWithSecurityScope
                                relativeToURL:nil
                          bookmarkDataIsStale:&isStale
                                        error:&bookmarkError];
      if (url) {
        [url startAccessingSecurityScopedResource];
      }
    }
  }

  // Fallback to direct path
  if (!url) {
    url = [NSURL fileURLWithPath:filePath];
  }

  NSError *error = nil;
  NSData *data = [NSData dataWithContentsOfURL:url options:0 error:&error];

  if (error || !data) {
    if (url && bookmarkBase64.length > 0) {
      [url stopAccessingSecurityScopedResource];
    }
    reject(@"READ_ERROR", error ? error.localizedDescription : @"File not found", error);
    return;
  }

  // Create fresh bookmark if stale
  NSString *newBookmark = @"";
  if (isStale || bookmarkBase64.length == 0) {
    NSData *bookmark = [url bookmarkDataWithOptions:NSURLBookmarkCreationWithSecurityScope
                      includingResourceValuesForKeys:nil
                                     relativeToURL:nil
                                             error:nil];
    if (bookmark) {
      newBookmark = [bookmark base64EncodedStringWithOptions:0];
    }
  }

  NSDictionary *result = @{
    @"name": url.lastPathComponent ?: @"",
    @"path": url.path ?: filePath,
    @"data": [data base64EncodedStringWithOptions:0] ?: @"",
    @"size": @(data.length),
    @"bookmark": newBookmark.length > 0 ? newBookmark : (bookmarkBase64 ?: @""),
  };

  if (bookmarkBase64.length > 0) {
    [url stopAccessingSecurityScopedResource];
  }

  resolve(result);
}

@end
