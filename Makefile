PKG := com.designeng.channelviewer
APK_DEBUG := android/app/build/outputs/apk/debug/app-debug.apk
APK_RELEASE := android/app/build/outputs/apk/release/app-release.apk

.PHONY: reinstall build install release release-install release-build bump-version play-build

# Version bump type for `make release`: patch | minor | major
BUMP ?= patch

# --- Debug (needs Metro dev server running, otherwise "Unable to load script") ---

# Reinstall the already-built debug APK on the connected Android device
reinstall: install

install:
	adb reverse tcp:8081 tcp:8081
	adb install -r $(APK_DEBUG)
	adb shell monkey -p $(PKG) -c android.intent.category.LAUNCHER 1

# Rebuild native app and install it (use after native/config changes)
build:
	npx expo run:android --device

# --- Release (JS bundle embedded in the APK, works standalone) ---

# Bump version (commit), build the release APK and install it on the connected device
release: bump-version release-build release-install

# Aborts if git has any uncommitted changes; otherwise bumps the version in
# package.json + package-lock.json and commits just those two files.
bump-version:
	@if [ -n "$$(git status --porcelain)" ]; then \
		echo "WARNING: git has uncommitted changes. Commit or stash them before 'make release'."; \
		git status --short; \
		exit 1; \
	fi
	npm version $(BUMP) --no-git-tag-version
	@v=$$(node -p "require('./package.json').version"); \
	git add package.json package-lock.json && \
	git commit -m "Release $$v" && \
	echo "Bumped version to $$v"

release-build:
	cd android && ./gradlew assembleRelease

release-install:
	adb install -r $(APK_RELEASE)
	adb shell monkey -p $(PKG) -c android.intent.category.LAUNCHER 1

# --- Google Play variant (no downloads, no unofficial transcripts) ---

PLAY_AAB := dist-play/app-release.aab

# Builds the AAB, then regenerates android/ for the personal build, so the two never mix.
# NOTE: still signed with the debug key - Google Play needs an upload key.
play-build:
	@[ -n "$$EXPO_PUBLIC_REPORT_URL" ] || echo "WARNING: EXPO_PUBLIC_REPORT_URL is not set, AI reports will only open the share sheet."
	@status=0; \
	( export EXPO_PUBLIC_APP_VARIANT=play && \
	  npx expo prebuild -p android --clean && \
	  (cd android && ./gradlew bundleRelease) && \
	  mkdir -p dist-play && cp android/app/build/outputs/bundle/release/app-release.aab $(PLAY_AAB) ) || status=$$?; \
	npx expo prebuild -p android --clean || status=$$?; \
	[ $$status -eq 0 ] && echo "Built $(PLAY_AAB)"; \
	exit $$status
