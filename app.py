from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import base64
import json
from webauthn import (
    generate_registration_options,
    options_to_json,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    PublicKeyCredentialDescriptor,
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    RegistrationCredential,
    AuthenticationCredential
)

app = Flask(__name__)
CORS(app, origins=["https://atsh-here.github.io"], supports_credentials=True)

# In-memory storage (Use DB in production!)
users = {}
challenges = {}

# RP configuration
RP_ID = "atsh-here.github.io"
RP_NAME = "Passkey Test"
ORIGIN = "https://atsh-here.github.io"

@app.route("/")
def home():
    return "✅ Passkey Backend Working"

@app.route("/register-challenge", methods=["POST"])
def register_challenge():
    data = request.get_json()
    username = data.get("username")
    if not username:
        return "Missing username", 400

    user_id = base64.urlsafe_b64encode(os.urandom(16)).rstrip(b"=").decode()
    challenge = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()

    users[username] = {"id": user_id, "credentials": []}
    challenges[username] = challenge

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user_id=user_id.encode(),
        user_name=username,
        user_display_name=username,
        challenge=challenge.encode(),
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED
        )
    )

    return jsonify(json.loads(options_to_json(options)))

@app.route("/register-verify", methods=["POST"])
def register_verify():
    data = request.get_json()
    username = data.get("username")
    if username not in users:
        return "User not found", 400

    try:
        credential = RegistrationCredential.parse_raw(json.dumps(data))
        expected_challenge = challenges[username].encode()

        verification = verify_registration_response(
            credential=credential,
            expected_challenge=expected_challenge,
            expected_origin=ORIGIN,
            expected_rp_id=RP_ID
        )

        users[username]["credentials"].append({
            "id": verification.credential_id,
            "public_key": verification.credential_public_key,
            "sign_count": verification.sign_count
        })

        return "✅ Registration verified"
    except Exception as e:
        return f"❌ Verification failed: {str(e)}", 400

@app.route("/login-challenge", methods=["POST"])
def login_challenge():
    data = request.get_json()
    username = data.get("username")
    if username not in users or not users[username]["credentials"]:
        return "User not found or not registered", 400

    challenge = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b"=").decode()
    challenges[username] = challenge

    credentials = [
        PublicKeyCredentialDescriptor(id=cred["id"])
        for cred in users[username]["credentials"]
    ]

    options = generate_authentication_options(
        rp_id=RP_ID,
        challenge=challenge.encode(),
        allow_credentials=credentials,
        user_verification=UserVerificationRequirement.PREFERRED
    )

    return jsonify(json.loads(options_to_json(options)))

@app.route("/login-verify", methods=["POST"])
def login_verify():
    data = request.get_json()
    username = data.get("username")
    if username not in users:
        return "User not found", 400

    try:
        credential = AuthenticationCredential.parse_raw(json.dumps(data))
        stored_cred = users[username]["credentials"][0]
        expected_challenge = challenges[username].encode()

        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=stored_cred["public_key"],
            credential_current_sign_count=stored_cred["sign_count"],
        )

        stored_cred["sign_count"] = verification.new_sign_count
        return "✅ Login verified"
    except Exception as e:
        return f"❌ Login failed: {str(e)}", 400
