import { registerRootComponent } from 'expo';
import { Platform } from 'react-native';

import App from './App';

// Disable two-finger swipe back/forward navigation in Chrome
if (Platform.OS === 'web') {
  const style = document.createElement('style');
  style.textContent = 'html, body { overscroll-behavior-x: none; }';
  document.head.appendChild(style);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
