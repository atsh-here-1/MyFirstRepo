from flask import Flask, request, jsonify
from flask_cors import CORS
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
)
from webauthn.helpers.structs import (
    PublicKeyCredentialRpEntity,
    PublicKeyCredentialUserEntity,
    AuthenticatorSelectionCriteria,
    AttestationConveyancePreference,
    RegistrationCredential,
    AuthenticationCredential,
)
from webauthn.helpers.options_to_json import options_to_json
import base64
import json
import os

app = Flask(__name__)
CORS(app)

# Replace these with your actual RP ID and Name (must match frontend origin)
RP_ID = "atsh-here.github.io"
RP_NAME = "Passkey Test"

# In-memory "database"
user_store = {}

@app.route("/")
def hello():
    return "✅ WebAuthn Backend is running!"

@app.route("/register-challenge", methods=["POST"])
def register_challenge():
    data = request.json
    username = data.get("username")
    if not username:
        return "Username is required", 400

    user_id = base64.urlsafe_b64encode(os.urandom(16)).decode("utf-8").rstrip("=")

    user_store[username] = {
        "id": user_id,
        "credentials": [],
    }

    options = generate_registration_options(
        rp=PublicKeyCredentialRpEntity(id=RP_ID, name=RP_NAME),
        user=PublicKeyCredentialUserEntity(
            id=user_id.encode(),
            name=username,
            display_name=username,
        ),
        attestation=AttestationConveyancePreference.NONE,  # ✅ FIXED ENUM
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification="preferred",
            require_resident_key=False,
        ),
        timeout=60000,
    )

    # Store the challenge to verify later
    user_store[username]["challenge"] = options.challenge.decode()

    return jsonify(json.loads(options_to_json(options)))

@app.route("/register-verify", methods=["POST"])
def register_verify():
    data = request.get_json()
    username = data.get("username")
    attestation_response = data.get("attestationResponse")

    if not username or not attestation_response:
        return "Missing fields", 400

    expected_challenge = user_store[username]["challenge"]

    try:
        credential = RegistrationCredential.parse_obj(attestation_response)

        verification = verify_registration_response(
            credential=credential,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=f"https://{RP_ID}",
            require_user_verification=False,
        )

        # Save the credential ID and public key
        user_store[username]["credentials"].append({
            "credential_id": verification.credential_id,
            "public_key": verification.credential_public_key,
        })

        return "✅ Registration verified successfully"
    except Exception as e:
        return f"Verification failed: {str(e)}", 400

@app.route("/login-challenge", methods=["POST"])
def login_challenge():
    data = request.json
    username = data.get("username")
    if not username or username not in user_store:
        return "User not found", 404

    credentials = user_store[username]["credentials"]

    options = generate_authentication_options(
        rp_id=RP_ID,
        allow_credentials=[{
            "id": cred["credential_id"],
            "transports": ["internal"]
        } for cred in credentials],
        user_verification="preferred",
        timeout=60000,
    )

    # Store challenge
    user_store[username]["challenge"] = options.challenge.decode()

    return jsonify(json.loads(options_to_json(options)))

@app.route("/login-verify", methods=["POST"])
def login_verify():
    data = request.get_json()
    username = data.get("username")
    auth_response = data.get("authenticationResponse")

    if not username or not auth_response:
        return "Missing fields", 400

    expected_challenge = user_store[username]["challenge"]

    try:
        credential = AuthenticationCredential.parse_obj(auth_response)
        stored_cred = user_store[username]["credentials"][0]  # Assuming only one credential

        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=expected_challenge,
            expected_rp_id=RP_ID,
            expected_origin=f"https://{RP_ID}",
            credential_public_key=stored_cred["public_key"],
            credential_current_sign_count=0,
            require_user_verification=False,
        )

        return "✅ Login verified successfully"
    except Exception as e:
        return f"Verification failed: {str(e)}", 400

if __name__ == "__main__":
    app.run(debug=True)
