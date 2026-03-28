#import <React/RCTBridgeModule.h>

@interface FileDialogModule : NSObject <RCTBridgeModule>

@property (nonatomic, copy) void (^contextMenuResolve)(id);
@property (nonatomic, assign) BOOL contextMenuResolved;

@end
