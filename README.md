# Cyberpunk Login with Passkey

This project demonstrates a cyberpunk-themed login interface with support for passkey authentication.

## Setup

### Frontend

The frontend is a static website and can be run by opening the `index.html` file in a web browser.

### Backend

A local backend server is required for the passkey authentication to work. The backend is located in the `backend` directory.

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
