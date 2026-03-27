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
    panel.allowsMultipleSelection = NO;
    panel.message = @"Select a binary file to open";

    [panel beginWithCompletionHandler:^(NSModalResponse result) {
      if (result != NSModalResponseOK || panel.URL == nil) {
        resolve([NSNull null]);
        return;
      }

      NSError *error = nil;
      NSData *data = [NSData dataWithContentsOfURL:panel.URL options:0 error:&error];
      if (error) {
        reject(@"READ_ERROR", error.localizedDescription, error);
        return;
      }

      NSString *base64 = [data base64EncodedStringWithOptions:0];
      NSString *name = panel.URL.lastPathComponent;
      NSString *path = panel.URL.path;

      resolve(@{
        @"name": name ?: @"",
        @"path": path ?: @"",
        @"data": base64 ?: @"",
        @"size": @(data.length),
      });
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

@end
