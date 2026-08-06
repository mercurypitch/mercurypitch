import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.irchiinnuss.besidecue',
  appName: 'Beside Cue',
  webDir: 'dist',
  backgroundColor: '#fff5dd',
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_beside_cue',
      iconColor: '#c93513',
    },
  },
}

export default config
