// Adds to app.json what only the Play build needs.
module.exports = ({ config }) => {
  if (process.env.EXPO_PUBLIC_APP_VARIANT !== 'play') return config;
  return {
    ...config,
    android: {
      ...config.android,
      // Nothing is downloaded or drawn over other apps in this build.
      blockedPermissions: [
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ],
    },
  };
};
