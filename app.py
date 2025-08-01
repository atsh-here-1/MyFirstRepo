from flask import Flask, request, jsonify
from flask_cors import CORS
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response
)
from webauthn.helpers.strings import base64url_to_binary
from webauthn.helpers.structs import (
    PublicKeyCredentialRpEntity,
    PublicKeyCredentialUserEntity,
    AuthenticatorSelectionCriteria,
    AttestationConveyancePreference,
    RegistrationCredential,
    AuthenticationCredential,
    PublicKeyCredentialDescriptor
)
import os
import base64
import json

app = Flask(__name__)
CORS(app, origins=["https://atsh-here.github.io"], supports_credentials=True)

RP_ID = "atsh-here.github.io"
RP_NAME = "Passkey Test"
ORIGIN = f"https://{RP_ID}"

# In-memory data store
users = {}

@app.route("/")
def home():
    return "✅ Backend is running!"

@app.route("/register-challenge", methods=["POST"])
def register_challenge():
    username = request.json.get("username")
    if not username:
        return "Missing username", 400

    # Generate new user id or reuse
    user_id = users.get(username, {}).get("id") or base64.urlsafe_b64encode(os.urandom(16)).decode().rstrip("=")
    users[username] = {"id": user_id, "credentials": [], "challenge": ""}

    options = generate_registration_options(
        rp_id=RP_ID,
        rp_name=RP_NAME,
        user=PublicKeyCredentialUserEntity(
            id=user_id.encode(),
            name=username,
            display_name=username
        ),
        attestation=AttestationConveyancePreference.NONE,
        authenticator_selection=AuthenticatorSelectionCriteria(
            require_resident_key=False,
            user_verification="preferred"
        ),
        timeout=60000
    )
    users[username]["challenge"] = options.challenge.decode()

    return jsonify(options.model_dump())

@app.route("/register-verify", methods=["POST"])
def register_verify():
    data = request.get_json()
    username = data.get("username")
    att_resp = data.get("attestationResponse")
    if not username or not att_resp:
        return "Missing fields", 400

    expected_challenge = users[username]["challenge"]
    try:
        cred = RegistrationCredential.parse_obj(att_resp)
        verification = verify_registration_response(
            credential=cred,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            require_user_verification=False
        )
        users[username]["credentials"] = [{
            "credential_id": verification.credential_id,
            "public_key": verification.credential_public_key,
            "sign_count": verification.sign_count
        }]
        return "✅ Registration verified"
    except Exception as e:
        return f"❌ Verification failed: {str(e)}", 400

@app.route("/login-challenge", methods=["POST"])
def login_challenge():
    username = request.json.get("username")
    if not username or username not in users or not users[username]["credentials"]:
        return "User not found or not registered", 400

    creds = users[username]["credentials"]
    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[PublicKeyCredentialDescriptor(id=c["credential_id"]) for c in creds],
        user_verification="preferred",
        timeout=60000
    )
    users[username]["challenge"] = options.challenge.decode()
    return jsonify(options.model_dump())

@app.route("/login-verify", methods=["POST"])
def login_verify():
    data = request.get_json()
    username = data.get("username")
    auth_resp = data.get("authenticationResponse")
    if not username or not auth_resp:
        return "Missing fields", 400

    expected_challenge = users[username]["challenge"]
    try:
        cred = AuthenticationCredential.parse_obj(auth_resp)
        stored = users[username]["credentials"][0]

        verification = verify_authentication_response(
            credential=cred,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=ORIGIN,
            credential_public_key=stored["public_key"],
            credential_current_sign_count=stored["sign_count"],
            require_user_verification=False
        )

        stored["sign_count"] = verification.new_sign_count
        return "✅ Login verified"
    except Exception as e:
        return f"❌ Login failed: {str(e)}", 400
