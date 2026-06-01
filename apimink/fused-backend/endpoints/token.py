from fastapi import APIRouter
from pydantic import BaseModel
import hashlib
import hmac
import re

router = APIRouter(prefix="/token", tags=["Tokenization"])

class TokenRequest(BaseModel):
    data: str
    salt: str = "fused-secret-salt"
    format: str = "generic"  # generic, credit_card, email

class TokenResponse(BaseModel):
    token: str

def luhn_checksum(n: str) -> int:
    digits = [int(d) for d in n]
    for i in range(len(digits) - 1, -1, -2):
        digits[i] *= 2
        if digits[i] > 9:
            digits[i] -= 9
    return sum(digits) % 10

def generate_luhn_digit(n: str) -> str:
    # Append a '0' and check sum
    check = luhn_checksum(n + '0')
    return str((10 - check) % 10)

def tokenize_generic(data: str, salt: str) -> str:
    return hmac.new(salt.encode(), data.encode(), hashlib.sha256).hexdigest()

def tokenize_credit_card(data: str, salt: str) -> str:
    # Keep the first digit (network) and last 4 if possible, or just generate deterministic 16 digits
    # For this implementation, we generate a deterministic 16-digit number
    h = hmac.new(salt.encode(), data.encode(), hashlib.sha256).hexdigest()
    # Convert hex to big integer
    big_int = int(h, 16)
    # Get 15 digits
    base_15 = str(big_int)[:15].zfill(15)
    # Add check digit
    check_digit = generate_luhn_digit(base_15)
    return base_15 + check_digit

def tokenize_email(data: str, salt: str) -> str:
    parts = data.split("@")
    if len(parts) != 2:
        return tokenize_generic(data, salt)[:10] + "@example.com"
    
    local_hash = hmac.new(salt.encode(), parts[0].encode(), hashlib.sha256).hexdigest()[:12]
    return f"{local_hash}@{parts[1]}"

def tokenize_ssn(data: str, salt: str) -> str:
    h = hmac.new(salt.encode(), data.encode(), hashlib.sha256).hexdigest()
    big_int = int(h, 16)
    s = str(big_int).zfill(9)
    return f"{s[:3]}-{s[3:5]}-{s[5:9]}"

def tokenize_phone(data: str, salt: str) -> str:
    h = hmac.new(salt.encode(), data.encode(), hashlib.sha256).hexdigest()
    big_int = int(h, 16)
    s = str(big_int).zfill(10)
    return f"({s[:3]}) {s[3:6]}-{s[6:10]}"

@router.post("", response_model=TokenResponse)
async def tokenize(request: TokenRequest):
    if request.format == "credit_card":
        token = tokenize_credit_card(request.data, request.salt)
    elif request.format == "email":
        token = tokenize_email(request.data, request.salt)
    elif request.format == "ssn":
        token = tokenize_ssn(request.data, request.salt)
    elif request.format == "phone":
        token = tokenize_phone(request.data, request.salt)
    else:
        token = tokenize_generic(request.data, request.salt)
    
    return {"token": token}
