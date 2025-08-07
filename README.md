# Cyberpunk Login with Passkey

This project demonstrates a cyberpunk-themed login interface with support for passkey authentication.

## Setup

To run this project, you need to run the backend server, which also serves the frontend.

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the server:**
    ```bash
    npm start
    ```

    The server will start on `http://localhost:8000`.

### Firebase

This project also supports email/password and Google login using Firebase. To use this functionality, you need to configure your Firebase project.

1.  Open the `firebase-init.js` file.
2.  Replace the placeholder `firebaseConfig` object with your own Firebase project's configuration.
