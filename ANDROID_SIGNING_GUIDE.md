# Android APK Consistent Signing & Versioning Guide

This document outlines the build configuration, consistent signing rules, and automatic versioning process for the FixOCar Workshop Android APK to prevent **"App Not Installed: Package conflicts with an existing package"** (`INSTALL_FAILED_UPDATE_INCOMPATIBLE`) errors during APK updates.

---

## 1. Why Signature & Version Mismatches Cause Installation Failures

Android enforces strict app update rules at the operating system level:
1. **Signature Consistency**: Every APK update must be signed with the **exact same digital certificate / keystore** as the version currently installed on the device. If an updated APK is signed with a different key (or a temporary default key generated on a different build machine), Android will reject the installation with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.
2. **Monotonic Version Code**: The `versionCode` in `android/app/version.properties` must always be strictly greater than the currently installed version's `versionCode`.

---

## 2. Automated Versioning via `version.properties`

The project manages application versions through `android/app/version.properties` and `package.json`.

### `android/app/version.properties` Structure:
```properties
VERSION_CODE=5
VERSION_NAME=1.0.4
BUILD_NUMBER=5
APPLICATION_ID=com.fixocar.workshop
LAST_UPDATED=2026-09-16
```

### Automatic Version Bumping Command:
Run the following npm command prior to building a release/debug APK:
```bash
npm run bump:version
```
Or use the integrated build command:
```bash
npm run build:apk
```

**What `npm run bump:version` does automatically:**
1. Increments the patch version in `package.json` (e.g., `1.0.3` → `1.0.4`).
2. Reads `android/app/version.properties` and increments `VERSION_CODE` (e.g., `4` → `5`).
3. Updates `VERSION_NAME`, `BUILD_NUMBER`, `APPLICATION_ID`, and `LAST_UPDATED` timestamp in `android/app/version.properties`.
4. Ensures all build artifacts remain perfectly synchronized across platforms.

---

## 3. Consistent Keystore Signing Configuration

In `android/app/build.gradle`, signing configurations are set up to guarantee consistent signing across builds:

```groovy
signingConfigs {
    debug {
        if (file('debug.keystore').exists()) {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    release {
        if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        } else if (file('debug.keystore').exists()) {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
}
```

### Recommended Production Signing Setup:

1. **Generate a Shared Release Keystore** (run once):
   ```bash
   keytool -genkey -v -keystore android/app/release-key.jks \
     -keyalg RSA -keysize 2048 -validity 10000 \
     -alias fixocar-key -storepass YourSecretPassword -keypass YourSecretPassword
   ```

2. **Configure Environment Variables or `gradle.properties`**:
   Add to `android/gradle.properties` or set in CI/CD environment:
   ```properties
   MYAPP_RELEASE_STORE_FILE=release-key.jks
   MYAPP_RELEASE_STORE_PASSWORD=YourSecretPassword
   MYAPP_RELEASE_KEY_ALIAS=fixocar-key
   MYAPP_RELEASE_KEY_PASSWORD=YourSecretPassword
   ```

---

## 4. Building the APK

### Debug APK Build:
```bash
npm run build:apk
cd android && ./gradlew assembleDebug
```
*Output APK location*: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK Build:
```bash
npm run build:apk
cd android && ./gradlew assembleRelease
```
*Output APK location*: `android/app/build/outputs/apk/release/app-release-unsigned.apk` or `app-release.apk`

---

## 5. Troubleshooting Installation Failures

If you still encounter "App not installed" on a device during testing:
1. **Uninstall Existing Build First** (if switching keystores):
   ```bash
   adb uninstall com.fixocar.workshop
   ```
2. **Verify Version Code**: Check that `VERSION_CODE` in `android/app/version.properties` is higher than the installed APK version.
3. **Verify Keystore Consistency**: Ensure all team members or build server jobs use the same `release-key.jks` or shared `debug.keystore`.
