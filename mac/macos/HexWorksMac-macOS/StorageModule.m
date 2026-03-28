#import "StorageModule.h"

@implementation StorageModule

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(setItem:(NSString *)key
                  value:(NSString *)value)
{
  [[NSUserDefaults standardUserDefaults] setObject:value forKey:key];
  [[NSUserDefaults standardUserDefaults] synchronize];
}

RCT_EXPORT_METHOD(getItem:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *value = [[NSUserDefaults standardUserDefaults] stringForKey:key];
  resolve(value ?: [NSNull null]);
}

RCT_EXPORT_METHOD(removeItem:(NSString *)key)
{
  [[NSUserDefaults standardUserDefaults] removeObjectForKey:key];
  [[NSUserDefaults standardUserDefaults] synchronize];
}

@end
