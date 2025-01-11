# Set up Flutter
```bash
git clone https://github.com/flutter/flutter.git -b stable
export PATH="$PATH:`pwd`/flutter/bin"
flutter doctor
```

Fix: Android Toolchain - Unable to Locate Android SDK
Install the Android SDK in the Codespace:
```bash
sudo apt update
sudo apt install -y android-sdk
```
Add the Android SDK to my PATH
```bash
export ANDROID_HOME=/usr/lib/android-sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```
Configure Flutter to use the SDK
```bash
flutter config --android-sdk /usr/lib/android-sdk
```
Accept the Android licenses:
```bash
flutter doctor --android-licenses
```