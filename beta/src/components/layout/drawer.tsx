/**
 * Drawer Component - Slide-in overlay panel for mobile navigation
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { useAnimatedValue } from '../../hooks/use-animated-value';

interface DrawerProps {
  visible: boolean;
  side: 'left' | 'right';
  onClose: () => void;
  children: React.ReactNode;
}

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.8, 320);

export function Drawer({ visible, side, onClose, children }: DrawerProps) {
  const translateX = useAnimatedValue(side === 'left' ? -DRAWER_WIDTH : DRAWER_WIDTH);
  const backdropOpacity = useAnimatedValue(0);

  // Swipe-to-dismiss tracking
  const panStartX = useRef(0);
  const panCurrentX = useAnimatedValue(0);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: side === 'left' ? -DRAWER_WIDTH : DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, side, translateX, backdropOpacity]);

  // Web touch handlers for swipe-to-dismiss
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;

    const drawerEl = drawerRef.current as unknown as HTMLElement;
    if (!drawerEl) return;

    const handleTouchStart = (e: TouchEvent) => {
      panStartX.current = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - panStartX.current;
      // Only allow swiping in the dismiss direction
      if (side === 'left' && dx < 0) {
        panCurrentX.setValue(dx);
      } else if (side === 'right' && dx > 0) {
        panCurrentX.setValue(dx);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - panStartX.current;
      const threshold = DRAWER_WIDTH * 0.3;

      if ((side === 'left' && dx < -threshold) || (side === 'right' && dx > threshold)) {
        onClose();
      }
      // Reset pan offset
      Animated.timing(panCurrentX, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
    };

    drawerEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    drawerEl.addEventListener('touchmove', handleTouchMove, { passive: true });
    drawerEl.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      drawerEl.removeEventListener('touchstart', handleTouchStart);
      drawerEl.removeEventListener('touchmove', handleTouchMove);
      drawerEl.removeEventListener('touchend', handleTouchEnd);
    };
  }, [visible, side, onClose, panCurrentX]);

  const drawerRef = useRef<View>(null);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={styles.backdropTouch} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        ref={drawerRef as React.RefObject<View>}
        style={[
          styles.drawer,
          side === 'left' ? styles.drawerLeft : styles.drawerRight,
          {
            width: DRAWER_WIDTH,
            transform: [
              { translateX: Animated.add(translateX, panCurrentX) as unknown as number },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdropTouch: {
    flex: 1,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#1e1e1e',
  },
  drawerLeft: {
    left: 0,
  },
  drawerRight: {
    right: 0,
  },
});

export default Drawer;
