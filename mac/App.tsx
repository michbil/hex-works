import React from 'react';
import {View, Text, StyleSheet, Platform} from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hex Works macOS</Text>
      <Text style={styles.info}>Platform.OS = {Platform.OS}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 16,
  },
  info: {
    fontSize: 14,
    color: '#cccccc',
  },
});
