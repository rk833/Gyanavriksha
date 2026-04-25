"""Third-party compatibility shims.

Import this module before any library that depends on the patched packages.
"""
import bcrypt as _bcrypt

if not hasattr(_bcrypt, "__about__"):
    _bcrypt.__about__ = type("__about__", (), {"__version__": _bcrypt.__version__})()
