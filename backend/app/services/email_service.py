import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email(to_email: str, token: str) -> None:
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify your Gyanavriksha account"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Gyanavriksha!</h2>
        <p>Thanks for creating an account. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verify_url}"
               style="background-color: #2563eb; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify Email
            </a>
        </div>
        <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br/>
            <a href="{verify_url}">{verify_url}</a>
        </p>
        <p style="color: #999; font-size: 12px;">This link expires in 24 hours.</p>
    </div>
    """
    _send_email(to_email, subject, html)


def send_password_reset_email(to_email: str, token: str) -> None:
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your Gyanavriksha password"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}"
               style="background-color: #2563eb; color: white; padding: 12px 30px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;">
                Reset Password
            </a>
        </div>
        <p style="color: #666; font-size: 14px;">
            Or copy and paste this link into your browser:<br/>
            <a href="{reset_url}">{reset_url}</a>
        </p>
        <p style="color: #999; font-size: 12px;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
        </p>
    </div>
    """
    _send_email(to_email, subject, html)


def send_welcome_email(to_email: str, full_name: str, password: str) -> None:
    """Send a welcome email containing the user's initial credentials."""
    subject = "Welcome to Gyanavriksha — Your Account is Ready"
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to Gyanavriksha, {full_name}!</h2>
        <p>An administrator has created an account for you. Use the credentials below to sign in:</p>
        <div style="background: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 4px 0;"><strong>Email:</strong> {to_email}</p>
            <p style="margin: 4px 0;"><strong>Password:</strong> {password}</p>
        </div>
        <p style="color: #666; font-size: 14px;">Please change your password after your first login.</p>
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
