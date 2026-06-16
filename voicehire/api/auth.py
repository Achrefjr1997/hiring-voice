import os
import secrets
from datetime import datetime, timedelta
from pathlib import Path
from passlib.context import CryptContext
from jose import jwt

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

# Auto-generate JWT_SECRET if not in .env
_env_path = Path(".env")
if _env_path.exists() and "JWT_SECRET" in _env_path.read_text():
    JWT_SECRET = os.environ.get("JWT_SECRET", "")
else:
    JWT_SECRET = secrets.token_urlsafe(32)
    try:
        with open(_env_path, "a") as f:
            f.write(f"\nJWT_SECRET={JWT_SECRET}\n")
        print(f"[auth] Generated JWT_SECRET and saved to .env")
    except Exception as e:
        print(f"[auth] Failed to write JWT_SECRET to .env: {e}")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except Exception:
        return None
