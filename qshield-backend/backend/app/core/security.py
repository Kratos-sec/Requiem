import os
import logging
from datetime import datetime, timedelta
import jwt
from fastapi.security import OAuth2PasswordBearer
import bcrypt

logger = logging.getLogger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "qshield_super_secret_key_123!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours
TEMP_TOKEN_EXPIRE_MINUTES = 5  # short-lived token for mid-login 2FA step

if SECRET_KEY == "qshield_super_secret_key_123!":
    logger.warning(
        "⚠️  Using default SECRET_KEY — set a strong SECRET_KEY in your .env for production!"
    )

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") == "2fa_pending":
            return None
        return payload
    except jwt.PyJWTError:
        return None


def create_temp_token(email: str) -> str:
    """Short-lived JWT issued after password check when 2FA is required.
    Has a special 'type' claim so it cannot be used as a real access token.
    """
    expire = datetime.utcnow() + timedelta(minutes=TEMP_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": email, "type": "2fa_pending", "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_temp_token(token: str) -> str | None:
    """Decode a 2FA pending token. Returns the user's email, or None if invalid/expired."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "2fa_pending":
            return None
        return payload.get("sub")
    except jwt.PyJWTError:
        return None
