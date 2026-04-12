#!/usr/bin/env python3
"""
Secure Flask Web App - Project 13
Demonstrates secure web application practices.

EDUCATIONAL USE ONLY. Production apps need professional review.
"""

from flask import Flask, request, jsonify, abort, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_csp import csp
import hashlib
import secrets
import time
import re
from functools import wraps

app = Flask(__name__)

# Security configuration
app.config['SECRET_KEY'] = secrets.token_hex(32)
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = 3600  # 1 hour

# Rate limiting
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# CSP header
csp(app, default_src="'self'")

# Simple password hashing
def hash_password(password: str, salt: str = None) -> tuple:
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return pwd_hash.hex(), salt

def verify_password(password: str, pwd_hash: str, salt: str) -> bool:
    new_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(new_hash, pwd_hash)

# Input validation
def validate_email(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def sanitize_input(data: str, max_length: int = 1000) -> str:
    return data[:max_length].strip()

# Rate limit exceeded handler
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        "error": "Rate limit exceeded",
        "message": "Too many requests. Please try again later.",
        "retry_after": e.description
    }), 429

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    return response

# Routes
@app.route('/')
def index():
    return jsonify({
        "message": "Secure Flask API",
        "version": "1.0",
        "security_features": [
            "Rate limiting",
            "CSP headers",
            "Secure cookies",
            "Input validation",
            "Password hashing (PBKDF2)"
        ]
    })

@app.route('/health')
def health():
    return jsonify({"status": "healthy", "timestamp": time.time()})

@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.get_json() or {}
    
    email = sanitize_input(data.get('email', ''))
    password = data.get('password', '')
    
    # Validate input
    if not email or not password:
        abort(400, description="Email and password required")
    
    if not validate_email(email):
        abort(400, description="Invalid email format")
    
    if len(password) < 8:
        abort(400, description="Password must be at least 8 characters")
    
    # In real app: check database
    # For demo: just return success
    return jsonify({
        "message": "Login successful",
        "user": email
    })

@app.route('/register', methods=['POST'])
@limiter.limit("3 per minute")
def register():
    data = request.get_json() or {}
    
    email = sanitize_input(data.get('email', ''))
    password = data.get('password', '')
    
    # Validate
    if not email or not password:
        abort(400, description="Email and password required")
    
    if not validate_email(email):
        abort(400, description="Invalid email format")
    
    if len(password) < 12:
        abort(400, description="Password must be at least 12 characters")
    
    # Hash password
    pwd_hash, salt = hash_password(password)
    
    # In real app: store in database
    return jsonify({
        "message": "Registration successful",
        "user": email
    })

@app.route('/api/secure-data')
@limiter.limit("10 per minute")
def secure_data():
    # Require authentication
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description="Authorization required")
    
    return jsonify({
        "data": "This is sensitive information",
        "classification": "internal"
    })

if __name__ == '__main__':
    print("""
╔════════════════════════════════════════════════════════════════╗
║     Secure Flask Web App - Project 13                        ║
║                                                                ║
║     Security features enabled:                                ║
║     - Rate limiting                                           ║
║     - CSP headers                                             ║
║     - Secure session cookies                                  ║
║     - Input validation                                        ║
║     - Password hashing (PBKDF2)                              ║
║     - Security headers                                        ║
╚════════════════════════════════════════════════════════════════╝
    """)
    app.run(host='0.0.0.0', port=5000, debug=False)
