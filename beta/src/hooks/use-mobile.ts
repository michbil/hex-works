import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

const MOBILE_BREAKPOINT = 768;

export function useMobile(): { isMobile: boolean } {
  const [isMobile, setIsMobile] = useState(() => {
    if (Platform.OS !== 'web') return true;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isMobile };
}
