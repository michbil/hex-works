#import <React/RCTViewManager.h>

@interface RCT_EXTERN_MODULE(HexViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(bufferBase64, NSString)
RCT_EXPORT_VIEW_PROPERTY(colorBase64, NSString)
RCT_EXPORT_VIEW_PROPERTY(markedBase64, NSString)
RCT_EXPORT_VIEW_PROPERTY(bufferLength, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(cursorPosition, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(selectionStart, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(selectionEnd, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(bytesPerLine, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(scrollOffset, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(fontSize, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(isEditing, BOOL)
RCT_EXPORT_VIEW_PROPERTY(editNibble, NSString)
RCT_EXPORT_VIEW_PROPERTY(focused, BOOL)
RCT_EXPORT_VIEW_PROPERTY(heatmapBase64, NSString)
RCT_EXPORT_VIEW_PROPERTY(heatmapMaxChanges, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(onBytePress, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onSelectionChange, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onScroll, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onHexKeyDown, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onContextMenuAction, RCTDirectEventBlock)

@end
