#!/bin/bash
# react-native-macos is a complete fork of react-native with macOS support.
# Symlink react-native -> react-native-macos so Metro resolves all RN imports
# through the macOS fork (which includes .macos.js platform files).

cd "$(dirname "$0")/.."

if [ -d "node_modules/react-native-macos" ] && [ ! -L "node_modules/react-native" ]; then
  mv node_modules/react-native node_modules/react-native-upstream
  ln -s react-native-macos node_modules/react-native
  echo "Symlinked react-native -> react-native-macos"
fi
