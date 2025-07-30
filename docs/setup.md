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
# TODO
```

## Run the GymCoach App

Install node dependencies and run the app
```bash
cd GymCoach/gymcoach
npm install
npm start
```

The app will be available at http://localhost:3000
