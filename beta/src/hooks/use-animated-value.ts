import { useRef } from 'react';
import { Animated } from 'react-native';

/** useAnimatedValue polyfill that works with react-native-web */
export function useAnimatedValue(initialValue: number): Animated.Value {
  "use no memo";
  const ref = useRef<Animated.Value | null>(null);
  if (ref.current === null) {
    ref.current = new Animated.Value(initialValue);
  }
  // eslint-disable-next-line
  return ref.current;
}
