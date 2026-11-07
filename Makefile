APK := android/app/build/outputs/apk/debug/app-debug.apk
PKG := com.designeng.channelviewer

.PHONY: reinstall build install

# Reinstall the already-built debug APK on the connected Android device
reinstall: install

install:
	adb install -r $(APK)
	adb shell monkey -p $(PKG) -c android.intent.category.LAUNCHER 1

# Rebuild native app and install it (use after native/config changes)
build:
	npx expo run:android --device
