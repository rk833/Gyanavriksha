const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;

const config = getDefaultConfig(projectRoot);
const defaultResolveRequest = config.resolver.resolveRequest;

/**
 * react-native-webview's package "react-native" entry points at src/index.ts, which
 * imports "./WebView". Some Metro setups fail to resolve ./WebView → WebView.tsx on Windows.
 * Bypass the barrel and load the platform implementation directly.
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-webview' && platform && platform !== 'web') {
    const base = path.join(projectRoot, 'node_modules', 'react-native-webview', 'src');
    const map = {
      android: 'WebView.android.tsx',
      ios: 'WebView.ios.tsx',
      macos: 'WebView.macos.tsx',
      windows: 'WebView.windows.tsx',
    };
    const file = map[platform] ?? map.ios;
    const filePath = path.join(base, file);
    if (fs.existsSync(filePath)) {
      return { type: 'sourceFile', filePath };
    }
  }

  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
