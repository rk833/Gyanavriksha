"""Third-party compatibility shims.

Password hashing uses the ``bcrypt`` package directly (see ``app.core.security``).
This module is kept as an import anchor in ``app.main`` so future shims load first.
"""
