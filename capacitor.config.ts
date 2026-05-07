import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.ANDROID_SERVER_URL || 'http://192.168.1.100:3000';

const config: CapacitorConfig = {
  appId: 'com.bitebonansa.cafe',
  appName: 'Bite Bonansa Cafe',
  webDir: 'public',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    androidScheme: 'http',
  },
};

export default config;
