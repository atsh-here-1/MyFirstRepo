from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import os

app = Flask(__name__)
CORS(app)

CORBADO_API_SECRET = "corbado1_bV9LzCVuLghRZtcSPxAXjJijENXAX2"
PROJECT_ID = "pro-3857098473696981499"
CORBADO_BACKEND_API_URL = "https://backendapi.cloud.corbado.io"

HEADERS = {
    "Authorization": f"Bearer {CORBADO_API_SECRET}",
    "Content-Type": "application/json"
}

@app.route("/register-challenge", methods=["POST"])
def register_challenge():
    data = request.get_json()
    username = data.get("username")

    payload = {
        "username": username,
        "userID": username,
        "rpDisplayName": "Test Web App"
    }

    res = requests.post(f"{CORBADO_BACKEND_API_URL}/v1/public/passkey/register-challenge", 
                        headers=HEADERS, json=payload)

    return jsonify(res.json())

@app.route("/register", methods=["POST"])
def register():
    res = requests.post(f"{CORBADO_BACKEND_API_URL}/v1/public/passkey/register",
                        headers=HEADERS, json=request.get_json())
    return jsonify(res.json())

@app.route("/login-challenge", methods=["POST"])
def login_challenge():
    data = request.get_json()
    username = data.get("username")

    payload = {
        "username": username
    }

    res = requests.post(f"{CORBADO_BACKEND_API_URL}/v1/public/passkey/login-challenge",
                        headers=HEADERS, json=payload)

    return jsonify(res.json())

@app.route("/login", methods=["POST"])
def login():
    res = requests.post(f"{CORBADO_BACKEND_API_URL}/v1/public/passkey/login",
                        headers=HEADERS, json=request.get_json())
    return jsonify(res.json())

@app.route("/")
def hello():
    return "Corbado backend is running!"

if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
