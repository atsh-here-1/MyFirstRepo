# Cyberpunk Login with Passkey

This project demonstrates a cyberpunk-themed login interface with support for passkey authentication.

## Project Structure

The project is divided into two main parts:

-   `frontend/`: A static website built with HTML, CSS, and JavaScript.
-   `backend/`: A Node.js server with Express that handles the passkey authentication logic.

## Local Development

To run this project locally, you will need to run the frontend and backend servers separately.

### Backend

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

    The backend server will start on `http://localhost:8000`.

### Frontend

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Create a `config.js` file:**
    Create a `config.js` file in the `frontend` directory by copying the `config.js.example` file.
    ```bash
    cp config.js.example config.js
    ```

3.  **Run a simple HTTP server:**
    You can use any simple HTTP server to serve the frontend files. If you have Python installed, you can use:
    ```bash
    python -m http.server 3000
    ```
    If you have `npx` installed, you can use:
    ```bash
    npx serve -l 3000
    ```

    The frontend will be available at `http://localhost:3000`.

## Deployment

### Backend on Render

1.  Create a new "Web Service" on Render and connect it to your GitHub repository.
2.  Set the "Build Command" to `npm install`.
3.  Set the "Start Command" to `npm start`.
4.  Add the following environment variables:
    -   `PORT`: `10000` (Render's default port)
    -   `RP_ID`: Your frontend's domain name (e.g., `your-domain.netlify.app`)
    -   `EXPECTED_ORIGIN`: The full URL of your frontend (e.g., `https://your-domain.netlify.app`)

### Frontend on Netlify

1.  Create a new site on Netlify and connect it to your GitHub repository.
2.  Set the "Build command" to empty.
3.  Set the "Publish directory" to `frontend`.
4.  Create a `frontend/config.js` file with the URL of your deployed backend:
    ```javascript
    window.config = {
      backendUrl: 'https://your-backend-url.onrender.com'
    };
    ```
    **Important:** Make sure to not commit this file to your repository. The `.gitignore` file is already configured to ignore it. You will need to create this file locally and Netlify will use it when you deploy. Alternatively, you can use Netlify's "snippet injection" feature to inject this configuration into your `index.html` file.
