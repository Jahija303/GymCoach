# Setup the project

## Install nodejs with nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash

source ~/.bashrc

nvm list-remote

nvm install lts/jod

nvm use lts/jod

node -v
```

## Install system dependencies

```bash
# sudo apt update
# sudo apt upgrade
# sudo apt install -y libopencv-dev python3-opencv
# pkg-config --modversion opencv4 # verifiy installation
# sudo apt install -y build-essential cmake

# # where is opencv installed
# find /usr -name "libopencv_core.so*" 2>/dev/null | head -5
```

## Run the GymCoach App

Install node dependencies and run the app
```bash
cd GymCoach/gymcoach
npm install
npm start
```

The app will be available at http://localhost:3000
