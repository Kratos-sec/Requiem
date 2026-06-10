import io
import base64
from datetime import timedelta

import pyotp
import qrcode
import qrcode.image.svg
from sqlalchemy import func, inspect as sa_inspect
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr

import jwt

from backend.app.db import get_db
from backend.app.models import User
from backend.app.schemas import (
    UserCreate,
    UserOut,
    LoginWithTOTPResponse,
    TOTPSetupResponse,
    TOTPCodeRequest,
    TOTPVerifyLoginRequest,
)
from backend.app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    decode_access_token,
    create_temp_token,
    decode_temp_token,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    oauth2_scheme,
    SECRET_KEY,
    ALGORITHM,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Dependency: resolve the currently authenticated user from Bearer token
# ---------------------------------------------------------------------------

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        if not payload:
            raise credentials_exception
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    if payload.get("token_version", 0) != user.token_version:
        raise credentials_exception
    return user


# ---------------------------------------------------------------------------
# Register
# ---------------------------------------------------------------------------

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """Create a new user account. Rejects duplicate emails and weak passwords."""
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists.",
        )

    hashed_password = get_password_hash(user.password)
    new_user = User(email=user.email, hashed_password=hashed_password, role="viewer")

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# ---------------------------------------------------------------------------
# Login  (aware of 2FA)
# ---------------------------------------------------------------------------

@router.post("/login", response_model=LoginWithTOTPResponse)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate with email + password.
    If the user has 2FA enabled, returns requires_2fa=True and a short-lived
    temp_token instead of the real access token.
    """
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 2FA enabled → issue a short-lived temp token; the real JWT comes after TOTP check
    if user.totp_enabled:
        temp_token = create_temp_token(user.email)
        return LoginWithTOTPResponse(requires_2fa=True, temp_token=temp_token, role=user.role)

    # No 2FA → issue the real JWT immediately
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "token_version": user.token_version},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return LoginWithTOTPResponse(access_token=access_token, token_type="bearer", requires_2fa=False)


# ---------------------------------------------------------------------------
# /auth/me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return current_user


# ---------------------------------------------------------------------------
# 2FA — Setup (generate secret + QR code)
# ---------------------------------------------------------------------------

@router.get("/2fa/setup", response_model=TOTPSetupResponse)
def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a new TOTP secret for the authenticated user and return a QR code.
    The 2FA is NOT yet active until /2fa/enable is called with a valid code.
    """
    secret = pyotp.random_base32()

    # Store the secret (pending confirmation) but don't enable yet
    current_user.totp_secret = secret
    current_user.totp_enabled = False
    db.commit()

    # Build the otpauth:// URI (compatible with Google Authenticator, Authy, etc.)
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name="QShield Security")

    # Generate QR code as an inline SVG (no Pillow dependency required)
    factory = qrcode.image.svg.SvgFillImage
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(image_factory=factory)

    buf = io.BytesIO()
    img.save(buf)
    svg_b64 = base64.b64encode(buf.getvalue()).decode()
    qr_data_uri = f"data:image/svg+xml;base64,{svg_b64}"

    return TOTPSetupResponse(qr_code=qr_data_uri, secret=secret)


# ---------------------------------------------------------------------------
# 2FA — Enable (confirm setup with first code)
# ---------------------------------------------------------------------------

@router.post("/2fa/enable")
def enable_2fa(
    req: TOTPCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Confirm 2FA setup. The user must provide the current code from their
    authenticator app. Enables 2FA if the code is correct.
    """
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA setup not started. Call GET /auth/2fa/setup first.",
        )

    totp = pyotp.TOTP(current_user.totp_secret)
    # valid_window=1 allows 1 period (30 s) before/after — handles minor clock drift
    if not totp.verify(req.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code — please check your authenticator app and try again.",
        )

    current_user.totp_enabled = True
    db.commit()

    return {"message": "Two-factor authentication has been enabled successfully. 🎉"}


# ---------------------------------------------------------------------------
# 2FA — Verify during login
# ---------------------------------------------------------------------------

@router.post("/2fa/verify", response_model=LoginWithTOTPResponse)
def verify_2fa_login(
    req: TOTPVerifyLoginRequest,
    db: Session = Depends(get_db),
):
    """Complete a 2FA-gated login. Accepts the temp_token from /login
    and the current 6-digit TOTP code. Returns the real JWT on success.
    """
    email = decode_temp_token(req.temp_token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again.",
        )

    user = db.query(User).filter(User.email == email).first()
    if not user or not user.totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not configured for this account.",
        )

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(req.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect code — please check your authenticator app.",
        )

    access_token = create_access_token(
        data={"sub": user.email, "role": user.role, "token_version": user.token_version},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return LoginWithTOTPResponse(access_token=access_token, token_type="bearer", requires_2fa=False)


# ---------------------------------------------------------------------------
# 2FA — Disable
# ---------------------------------------------------------------------------

@router.post("/2fa/disable")
def disable_2fa(
    req: TOTPCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disable 2FA. Requires the user to provide a valid current TOTP code
    to prevent accidental or unauthorised disabling.
    """
    if not current_user.totp_enabled or not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA is not enabled on this account.",
        )

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(req.code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid code — 2FA was NOT disabled.",
        )

    current_user.totp_enabled = False
    current_user.totp_secret = None
    db.commit()

    return {"message": "Two-factor authentication has been disabled."}


class UpdateEmailRequest(BaseModel):
    new_email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class AdminUserOut(BaseModel):
    id: int
    email: str
    role: str
    totp_enabled: bool = False
    token_version: int = 0

    class Config:
        from_attributes = True


class AdminRoleUpdateRequest(BaseModel):
    role: str


def _require_admin(current_user: User) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")


@router.put("/me/email", response_model=UserOut)
def update_email(
    req: UpdateEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")

    existing = db.query(User).filter(User.email == req.new_email, User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That email is already in use.")

    current_user.email = req.new_email
    current_user.token_version += 1
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect.")

    current_user.hashed_password = get_password_hash(req.new_password)
    current_user.token_version += 1
    db.commit()
    return {"message": "Password updated successfully. Please log in again."}


@router.post("/me/logout-all")
def logout_all_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.token_version += 1
    db.commit()
    return {"message": "All sessions have been logged out."}


@router.get("/admin/users", response_model=list[AdminUserOut])
def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    return db.query(User).order_by(User.id.asc()).all()


@router.put("/admin/users/{user_id}/role", response_model=AdminUserOut)
def update_user_role(
    user_id: int,
    req: AdminRoleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    if req.role not in {"admin", "viewer", "auditor", "itadmin"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role.")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.id == current_user.id and req.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin role while logged in.",
        )
    if target.role == "admin" and req.role != "admin":
        admin_count = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one admin must remain in the system.",
            )

    target.role = req.role
    target.token_version += 1
    db.commit()
    db.refresh(target)
    return target


@router.delete("/admin/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account.")

    db.delete(target)
    db.commit()
    return {"message": "User deleted successfully."}


@router.get("/admin/database")
def database_overview(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    inspector = sa_inspect(db.bind)
    tables = inspector.get_table_names()
    user_count = db.query(func.count(User.id)).scalar() or 0
    role_counts = {
        role: db.query(func.count(User.id)).filter(User.role == role).scalar() or 0
        for role in ["admin", "viewer", "auditor", "itadmin"]
    }
    return {
        "tables": tables,
        "users": user_count,
        "roles": role_counts,
    }
