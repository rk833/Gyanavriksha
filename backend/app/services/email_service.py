import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)
LOGO_URL = "https://i.postimg.cc/V6zdQ7k0/primary-logo.png"


def send_verification_email(to_email: str, token: str) -> None:
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify your Gyanavriksha account"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Verify your email address</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Complete your account setup</p>
        </div>
        <div style="padding:24px 26px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            Thanks for creating your Gyanavriksha account. Please verify your email using the button below.
          </p>
          <div style="text-align:center;margin:22px 0;">
            <a href="{verify_url}" style="background:#0f2f57;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;display:inline-block;">
              Verify Email
            </a>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:0 0 12px;">
            <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">Verification link</p>
            <a href="{verify_url}" style="word-break:break-all;color:#1d4ed8;font-size:13px;line-height:1.5;">{verify_url}</a>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            This verification link expires in 24 hours.
          </p>
        </div>
      </div>
    </div>
    """
    _send_email(to_email, subject, html)


def send_password_reset_email(to_email: str, token: str) -> None:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your Gyanavriksha password"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Reset your password</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Secure account recovery for your Gyanavriksha profile</p>
        </div>
        <div style="padding:24px 26px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            We received a request to reset your password. Click the button below to create a new one.
          </p>
          <div style="text-align:center;margin:22px 0;">
            <a href="{reset_url}" style="background:#0f2f57;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:700;display:inline-block;">
              Reset Password
            </a>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:0 0 12px;">
            <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">Reset link</p>
            <a href="{reset_url}" style="word-break:break-all;color:#1d4ed8;font-size:13px;line-height:1.5;">{reset_url}</a>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
          </p>
        </div>
      </div>
    </div>
    """
    _send_email(to_email, subject, html)


def send_welcome_email(to_email: str, full_name: str, password: str) -> None:
    """Send a welcome email containing the user's initial credentials."""
    subject = "Welcome to Gyanavriksha — Your Account is Ready"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:23px;line-height:1.3;">Welcome to Gyanavriksha, {full_name}!</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Your account is ready</p>
        </div>

        <div style="padding:24px 26px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            An administrator has created an account for you. Use the credentials below to sign in:
          </p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 14px 10px;margin:0 0 14px;">
            <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">Login Email</p>
            <p style="margin:0 0 12px;font-size:14px;color:#0f172a;word-break:break-all;"><strong>{to_email}</strong></p>

            <p style="margin:0 0 6px;font-size:12px;color:#64748b;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">Temporary Password</p>
            <p style="margin:0;font-size:22px;letter-spacing:0.08em;color:#0f2f57;font-weight:800;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 12px;display:inline-block;">
              {password}
            </p>
          </div>

          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px;margin:0 0 12px;">
            <p style="margin:0;color:#9a3412;font-size:13px;line-height:1.5;">
              <strong>Important:</strong> Please change your password after your first login.
            </p>
          </div>

          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            For security, keep this email private and do not share your credentials with anyone.
          </p>
        </div>
      </div>
    </div>
    """
    _send_email(to_email, subject, html)


def send_2fa_login_email(to_email: str, code: str, full_name: str | None = None) -> None:
    """Send a one-time 6-digit code for email-based two-factor login."""
    subject = "Your Gyanavriksha sign-in code"
    greeting_name = (full_name or "").strip() or "Learner"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Your Gyanavriksha sign-in code</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Two-factor authentication</p>
        </div>
        <div style="padding:24px 26px;">
          <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#334155;">
            Welcome to Gyanavriksha, <strong>{greeting_name}</strong>!
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">
            Use this one-time code to complete your login:
          </p>
          <div style="text-align:center;margin:18px 0 16px;">
            <span style="display:inline-block;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 22px;font-size:34px;font-weight:800;letter-spacing:0.28em;color:#0f2f57;">
              {code}
            </span>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            This code expires in 10 minutes. If you did not try to sign in, you can ignore this email.
          </p>
        </div>
      </div>
    </div>
    """
    _send_email(to_email, subject, html)


def _send_email(to_email: str, subject: str, html_body: str) -> None:
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(f"[EMAIL SKIPPED — no SMTP credentials] To: {to_email} | Subject: {subject}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM_EMAIL
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())

        logger.info(f"[EMAIL SENT] To: {to_email} | Subject: {subject}")
    except Exception as e:
        logger.error(f"[EMAIL FAILED] To: {to_email} | Error: {e}")
