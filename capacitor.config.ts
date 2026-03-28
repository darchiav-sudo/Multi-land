import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.multiland.app',
  appName: 'Multi Land',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    hostname: 'multiland.app', // Will need to be updated with your production domain
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#FFFFFF",
      showSpinner: true,
      spinnerColor: "#000000",
      androidSpinnerStyle: "large"
    },
    StatusBar: {
      style: "dark",
      backgroundColor: "#FFFFFF"
    }
  }
};

export default config;