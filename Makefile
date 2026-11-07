PKG := com.designeng.channelviewer
APK_DEBUG := android/app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := android/app/build/outputs/apk/release/app-release.apk

.PHONY: reinstall build install release release-install release-build

# --- Debug (needs Metro dev server running, otherwise "Unable to load script") ---

# Reinstall the already-built debug APK on the connected Android device
reinstall: install

install:
	adb install -r $(APK_DEBUG)
	adb shell monkey -p $(PKG) -c android.intent.category.LAUNCHER 1

# Rebuild native app and install it (use after native/config changes)
build:
	npx expo run:android --device

# --- Release (JS bundle embedded in the APK, works standalone) ---

# Build the release APK and install it on the connected device
release: release-build release-install

release-build:
	cd android && ./gradlew assembleRelease

release-install:
	adb install -r $(APK_RELEASE)
	adb shell monkey -p $(PKG) -c android.intent.category.LAUNCHER 1
