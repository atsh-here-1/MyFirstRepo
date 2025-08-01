# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response
)
from webauthn.helpers.structs import (
    PublicKeyCredentialRpEntity,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    PublicKeyCredentialDescriptor,
    RegistrationCredential,
    AuthenticationCredential
)
import secrets

app = Flask(__name__)
CORS(app, origins=["https://atsh-here.github.io"]) 

# ⚙️ CONFIG
RP_NAME = "Cyberpunk Access Terminal"
RP_ID = "atsh-here.github.io"
ORIGIN = "https://atsh-here.github.io"

# In-memory user store (🧠 replace with real DB later)
users = {}
challenges = {}

@app.route("/register-challenge", methods=["POST"])
def register_challenge():
    username = request.json.get("username")
    if not username:
        return "Username required", 400

    user_id = secrets.token_hex(16)
    challenge = secrets.token_urlsafe(32)

    options = generate_registration_options(
        rp=PublicKeyCredentialRpEntity(id=RP_ID, name=RP_NAME),
        user={"id": user_id.encode(), "name": username, "display_name": username},
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED
        ),
        challenge=challenge.encode()
    )

    users[username] = {"id": user_id, "credentials": []}
    challenges[username] = challenge

    return jsonify(options.model_dump())

@app.route("/register-verify", methods=["POST"])
def register_verify():
    try:
        data = request.get_json()
        username = data.get("username")
        if username not in users:
            return "User not found", 400

        credential = RegistrationCredential.parse_obj(data)
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenges[username],
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            require_user_verification=True
        )

        users[username]["credentials"].append({
            "credential_id": verification.credential_id,
            "public_key": verification.credential_public_key,
            "sign_count": verification.sign_count
        })

        return "✅ Passkey registered", 200
    except Exception as e:
        return f"❌ Registration failed: {str(e)}", 400

@app.route("/login-challenge", methods=["POST"])
def login_challenge():
    username = request.json.get("username")
    if username not in users:
        return "User not found", 400

    challenge = secrets.token_urlsafe(32)
    challenges[username] = challenge

    allow_credentials = [
        PublicKeyCredentialDescriptor(id=c["credential_id"])
        for c in users[username]["credentials"]
    ]

    options = generate_authentication_options(
        rp_id=RP_ID,
        challenge=challenge.encode(),
        allow_credentials=allow_credentials,
        user_verification=UserVerificationRequirement.PREFERRED
    )

    return jsonify(options.model_dump())

@app.route("/login-verify", methods=["POST"])
def login_verify():
    try:
        data = request.get_json()
        username = data.get("username")
        if username not in users:
            return "User not found", 400

        credential = AuthenticationCredential.parse_obj(data)
        stored = users[username]["credentials"][0]

        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=challenges[username],
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID,
            credential_public_key=stored["public_key"],
            credential_current_sign_count=stored["sign_count"],
            require_user_verification=True
        )

        stored["sign_count"] = verification.new_sign_count
        return "✅ Passkey login successful", 200

    except Exception as e:
        return f"❌ Login failed: {str(e)}", 400

@app.route("/")
def home():
    return "🔐 Passkey Flask Backend is running!"
