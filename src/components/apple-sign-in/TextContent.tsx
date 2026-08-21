import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface TextContentProps {
  userName: string;
}

export function TextContent({ userName }: TextContentProps) {
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.name} numberOfLines={1}>
        {userName}
      </Text>
      <Text style={styles.status}>Signing in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minHeight: 62,
  },
  name: {
    maxWidth: 300,
    color: '#050505',
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  status: {
    marginTop: 5,
    color: '#8E8E93',
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.15,
  },
});
