#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface MenuBarModule : RCTEventEmitter <RCTBridgeModule>

+ (void)emitMenuAction:(NSString *)action;

@end
