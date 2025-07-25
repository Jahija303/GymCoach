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

## Run the GymCoach App

1. Navigate to the gymcoach directory:
```bash
cd gymcoach
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

The app will be available at http://localhost:3000
