# Cyberpunk Login with Passkey

This project demonstrates a cyberpunk-themed login interface with support for passkey authentication.

## Setup

### Frontend

To run the frontend, you need to start the frontend server.

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the server:**
    ```bash
    node server.js
    ```

    The frontend will be available at `http://localhost:3000`.

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
