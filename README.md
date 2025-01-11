# Set up Flutter

## Install Basic Dependencies
```bash
sudo apt update
sudo apt install -y wget git unzip zip xz-utils curl libglu1-mesa ninja-build libgtk-3-dev
```

## Install Flutter
```bash
# Download Flutter SDK
wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.10.5-stable.tar.xz

# Extract and Move Flutter
tar xf flutter_linux_3.10.5-stable.tar.xz
sudo mv flutter /usr/local/flutter

# Add Flutter to PATH
echo 'export PATH="$PATH:/usr/local/flutter/bin"' >> ~/.bashrc
source ~/.bashrc

# Verify
flutter doctor
```

## Install Android SDK
```bash
# Download Command-Line Tools
wget https://dl.google.com/android/repository/commandlinetools-linux-8512546_latest.zip
# Remove the current cmdline-tools/latest directory
sudo rm -rf /usr/lib/android-sdk/cmdline-tools/latest
# Extract and move the tools
sudo mkdir -p /usr/lib/android-sdk/cmdline-tools
sudo unzip commandlinetools-linux-8512546_latest.zip -d /usr/lib/android-sdk/cmdline-tools
sudo mv /usr/lib/android-sdk/cmdline-tools/cmdline-tools /usr/lib/android-sdk/cmdline-tools/latest
# Verify the bin directory
ls /usr/lib/android-sdk/cmdline-tools/latest/bin

# Update the .bashrc file
echo 'export ANDROID_HOME=/usr/lib/android-sdk' >> ~/.bashrc
echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
source ~/.bashrc

# Verify that sdkmanager is now found
sdkmanager --version

# Change the ownership of the Android SDK directory to your user (codespace in GitHub Codespaces):
sudo chown -R $(whoami):$(whoami) /usr/lib/android-sdk

# Verify the ownership
ls -ld /usr/lib/android-sdk

# Install SDK Components
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.2"

# Accept Android Licenses
flutter doctor --android-licenses

# Verify
flutter doctor
```

## Install Chrome
```bash
# Install Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt-get install -f

# Set Chrome Executable Path
export CHROME_EXECUTABLE=/usr/bin/google-chrome

# Verify Chrome Installation
google-chrome --version
```
