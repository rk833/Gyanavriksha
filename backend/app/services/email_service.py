import logging
import smtplib
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)
LOGO_URL = "https://i.postimg.cc/V6zdQ7k0/primary-logo.png"


def _email_footer_html() -> str:
    year = datetime.now(timezone.utc).year
    support_email = settings.SMTP_FROM_EMAIL or "support@gyanavriksha.edu.np"
    return f"""
      <div style="padding:0 26px 22px;">
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 12px;" />
        <p style="margin:0 0 4px;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
          Need help? Contact us at
          <a href="mailto:{support_email}" style="color:#1d4ed8;text-decoration:none;">{support_email}</a>
        </p>
        <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;text-align:center;">
          This is an automated message from Gyanavriksha. Please do not reply directly.
        </p>
        <p style="margin:4px 0 0;color:#94a3b8;font-size:11px;line-height:1.6;text-align:center;">
          &copy; {year} Gyanavriksha. All rights reserved.
        </p>
      </div>
    """


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
        {_email_footer_html()}
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
        {_email_footer_html()}
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
        {_email_footer_html()}
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
        {_email_footer_html()}
      </div>
    </div>
    """
    _send_email(to_email, subject, html)


def send_contact_form_email(
    sender_name: str,
    sender_email: str,
    subject: str,
    message: str,
) -> None:
    """Forward a contact form submission to the site owner's inbox."""
    receiver = settings.CONTACT_RECEIVER_EMAIL
    email_subject = f"[Contact Form] {subject}"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">New Contact Form Message</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Received via Gyanavriksha website</p>
        </div>
        <div style="padding:24px 26px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin:0 0 18px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;width:90px;">From</td>
                <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">{sender_name}</td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">Email</td>
                <td style="padding:6px 0;">
                  <a href="mailto:{sender_email}" style="font-size:14px;color:#1d4ed8;text-decoration:none;">{sender_email}</a>
                </td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">Subject</td>
                <td style="padding:6px 0;font-size:14px;color:#0f172a;">{subject}</td>
              </tr>
            </table>
          </div>

          <div style="background:#f8fafc;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;padding:16px 18px;margin:0 0 16px;">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">Message</p>
            <p style="margin:0;font-size:14px;line-height:1.8;color:#1e293b;white-space:pre-wrap;">{message}</p>
          </div>

          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            You can reply directly to <a href="mailto:{sender_email}" style="color:#1d4ed8;">{sender_email}</a> to respond to this message.
          </p>
        </div>
        {_email_footer_html()}
      </div>
    </div>
    """
    _send_email(receiver, email_subject, html)


def send_contact_form_auto_reply(
    to_email: str,
    sender_name: str,
    subject: str,
) -> None:
    """Send an auto-acknowledgement to the contact form submitter."""
    email_subject = f"We received your message — Gyanavriksha"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Message Received!</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Thank you for getting in touch</p>
        </div>
        <div style="padding:24px 26px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            Hi <strong>{sender_name}</strong>,
          </p>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#475569;">
            Thank you for reaching out to Gyanavriksha! We've received your message about <strong>"{subject}"</strong> and will get back to you as soon as possible — typically within 24–48 hours.
          </p>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px;margin:0 0 14px;">
            <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
              For urgent issues, please submit a <strong>Support Ticket</strong> through your dashboard for a faster response.
            </p>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            Please do not reply to this auto-confirmation. Our team will contact you directly at this email address.
          </p>
        </div>
        {_email_footer_html()}
      </div>
    </div>
    """
    _send_email(to_email, email_subject, html)


def send_support_ticket_reply_email(
    to_email: str,
    full_name: str,
    ticket_id: str,
    subject_text: str,
    reply_message: str,
    admin_name: str | None = None,
) -> None:
    """Send an admin reply to a support ticket submitter."""
    short_id = ticket_id[:8].upper()
    sender_label = admin_name or "Gyanavriksha Support Team"
    subject = f"Re: Support Ticket #{short_id} — {subject_text}"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Response to Your Support Request</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">Ticket #{short_id}</p>
        </div>
        <div style="padding:24px 26px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            Hi <strong>{full_name}</strong>,
          </p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
            Our support team has responded to your ticket regarding <strong>"{subject_text}"</strong>. Here is their message:
          </p>

          <div style="background:#f8fafc;border-left:4px solid #2563eb;border-radius:0 12px 12px 0;padding:16px 18px;margin:0 0 18px;">
            <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px;">{sender_label}</p>
            <p style="margin:0;font-size:14px;line-height:1.8;color:#1e293b;white-space:pre-wrap;">{reply_message}</p>
          </div>

          <div style="background:#f1f5f9;border-radius:12px;padding:12px 14px;margin:0 0 14px;">
            <p style="margin:0;font-size:12px;color:#64748b;line-height:1.6;">
              <strong>Your Ticket Reference:</strong> #{short_id}<br />
              If you have further questions, please submit a new support ticket and reference this ID.
            </p>
          </div>
        </div>
        {_email_footer_html()}
      </div>
    </div>
    """
    _send_email(to_email, subject, html)


def send_support_ticket_confirmation_email(
    to_email: str,
    full_name: str,
    ticket_id: str,
    subject_text: str,
    category: str,
    priority: str,
) -> None:
    """Send a confirmation email after a support ticket is submitted."""
    short_id = ticket_id[:8].upper()
    priority_color = {
        "Low": "#64748b",
        "Medium": "#2563eb",
        "High": "#0f2f57",
        "Critical": "#dc2626",
    }.get(priority, "#334155")

    subject = f"Support Ticket #{short_id} Received — Gyanavriksha"
    html = f"""
    <div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,sans-serif;color:#0f172a;">
      <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe2ef;border-radius:18px;overflow:hidden;">
        <div style="padding:26px 26px 18px;background:linear-gradient(135deg,#0f2f57 0%,#2563eb 100%);text-align:center;">
          <img src="{LOGO_URL}" alt="Gyanavriksha" width="120" style="max-width:120px;height:auto;display:block;margin:0 auto 10px;" />
          <h2 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Support Request Received</h2>
          <p style="margin:8px 0 0;color:#dbeafe;font-size:13px;">We've got your ticket and will be in touch soon</p>
        </div>
        <div style="padding:24px 26px;">
          <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">
            Hi <strong>{full_name}</strong>, thank you for reaching out to Gyanavriksha Support!
          </p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#475569;">
            Your support ticket has been submitted and our team is already on it. Here's a summary of what we received:
          </p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin:0 0 16px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;width:110px;">Ticket ID</td>
                <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:700;">#{short_id}</td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">Subject</td>
                <td style="padding:6px 0;font-size:14px;color:#0f172a;">{subject_text}</td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">Category</td>
                <td style="padding:6px 0;font-size:14px;color:#0f172a;">{category}</td>
              </tr>
              <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">Priority</td>
                <td style="padding:6px 0;">
                  <span style="font-size:12px;font-weight:700;color:#ffffff;background:{priority_color};padding:3px 10px;border-radius:6px;">{priority.upper()}</span>
                </td>
              </tr>
            </table>
          </div>

          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:12px 14px;margin:0 0 14px;">
            <p style="margin:0;font-size:13px;color:#1e40af;line-height:1.6;">
              <strong>What happens next?</strong> Our support team will review your request and respond to this email address within the estimated response time for your priority level.
            </p>
          </div>
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
            Please keep this email for your records. Do not reply to this message — use your support ticket ID to reference this issue.
          </p>
        </div>
        {_email_footer_html()}
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
