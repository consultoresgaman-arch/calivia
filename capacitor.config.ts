import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.calivia.app',
  appName: 'Calivia',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
