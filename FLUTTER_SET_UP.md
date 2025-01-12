# Set up Flutter

## Create an Android Folder to save Flutter and Android SDK
```bash
# Create a Folder
mkdir Android
# Move to Android folder
cd Android
```
## Install Basic Dependencies
```bash
sudo apt update
sudo apt install -y wget git unzip zip xz-utils curl libglu1-mesa ninja-build libgtk-3-dev
```

## Install Flutter
```bash
# Download Flutter using git clone
git clone https://github.com/flutter/flutter.git
git clone https://github.com/flutter/flutter.git -b stable
# Add the flutter tool to your path
export PATH="$PATH:`pwd`/flutter/bin"

# Set the environment variable of flutter
nano ~/.bashrc
# Go to the bottom line and type
# {
# Flutter
export PATH=/workspaces/{codespace-name}/Android/flutter/bin:$PATH
# }
# Save and exit ctrl + x
# Reload the ~/.bashrc
source ~/.bashrc

# Check the installation
flutter doctor # if it cannot found, restart the codespace and rerun
```

## Resolve the 'Android toolchain' issue
```bash
# Download Command-Line Tools
# Go to 'https://developer.android.com/studio?hl=ko'
# download command line tools for linux e.g. commandlinetools-linux-11076708_latest.zip
# Upload the file to the main repo
# unzip name.zip 
# e.g. unzip commandlinetools-linux-11076708_latest.zip

# Remove the zip file
# e.g. rm commandlinetools-linux-11076708_latest.zip

# Move the cmdline-tools to Android
mv cmdline-tools Android

# Create a new directory, 'latest' in the cmdline-tools
mkdir Android/cmdline-tools/latest

# Move all files and folders alreay existed in the cmdline-tools into the latest
mv Android/cmdline-tools/* Android/cmdline-tools/latest/
# Again, set the environment variable of flutter
nano ~/.bashrc
# Go to the bottom line and type below
# {

# Android
export ANDROID=/workspaces/{Codespace-Name}/Android
export PATH=$ANDROID/cmdline-tools:$PATH
export PATH=$ANDROID/cmdline-tools/latest/bin:$PATH
export PATH=$ANDROID/platform-tools:$PATH

# Android SDK
export ANDROID_SDK=/workspaces/{Codespace-Name}/Android
export PATH=$ANDROID_SDK:$PATH

# # Android SDK
# export ANDROID_SDK=/workspaces/{Codespace-Name}/Android
# export PATH=$ANDROID_SDK/platform-tools:$ANDROID_SDK/cmdline-tools/latest/bin:$PATH
# }
# Save and exit ctrl + x
# Reload the ~/.bashrc
source ~/.bashrc

# Install sdk
/workspaces/{codespace-name}/Android/cmdline-tools/latest/bin/sdkmanager --install "cmdline-tools;latest"
# Accept the SDK Licenses
/workspaces/{codespace-name}/Android/cmdline-tools/latest/bin/sdkmanager --licenses
# Install latest version packages
/workspaces/{codespace-name}/Android/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-33" 
/workspaces/{codespace-name}/Android/cmdline-tools/latest/bin/sdkmanager "build-tools;34.0.0"
/workspaces/{codespace-name}/Android/cmdline-tools/latest/bin/sdkmanager "system-images;android-33;google_apis;x86_64"

# Accept Android Licenses
flutter doctor --android-licenses

# Verify
flutter doctor
```

## Resolve the 'Linux toolchain' issue
```bash
# Install ninja-build
sudo apt install ninja-build
sudo apt install libgtk-3-dev
```

## To Create new project
```bash
flutter create project-name

# To host the project to web
cd project-name
flutter run -d web-server --web-hostname=0.0.0.0
```
