import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import boto3
import httpx
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


def _password_reset_bodies(reset_link: str) -> tuple[str, str, str]:
    subject = "Reset Your eljiran.io Password"
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #3b82f6;">Reset Your Password</h2>
        <p>We received a request to reset your password. Click the link below:</p>
        <p><a href="{reset_link}" style="color: #3b82f6;">Reset Password</a></p>
        <p style="word-break: break-all; color: #6b7280;">{reset_link}</p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
      </div>
    </body>
    </html>
    """
    text_body = (
        "Reset Your eljiran.io Password\n\n"
        f"Open this link to reset your password:\n{reset_link}\n\n"
        "This link expires in 1 hour.\n"
    )
    return subject, html_body, text_body


def _from_address() -> str:
    from_email = settings.SMTP_FROM_EMAIL or settings.SES_FROM_EMAIL
    return f"{settings.SES_FROM_NAME} <{from_email}>"


def _send_via_resend(email: str, subject: str, html_body: str, text_body: str) -> bool:
    if not settings.RESEND_API_KEY:
        return False
    from_email = settings.SMTP_FROM_EMAIL or settings.SES_FROM_EMAIL
    try:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": f"{settings.SES_FROM_NAME} <{from_email}>",
                "to": [email],
                "subject": subject,
                "html": html_body,
                "text": text_body,
            },
            timeout=15.0,
        )
        if response.status_code in (200, 201):
            logger.info("Password reset email sent via Resend to %s", email)
            return True
        logger.error("Resend failed for %s: %s %s", email, response.status_code, response.text)
    except Exception as e:
        logger.error("Resend error for %s: %s", email, e)
    return False


def _send_via_ses(email: str, subject: str, html_body: str, text_body: str) -> bool:
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        return False
    try:
        ses_client = boto3.client(
            "ses",
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.ses_region,
        )
        response = ses_client.send_email(
            Source=_from_address(),
            Destination={"ToAddresses": [email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": html_body, "Charset": "UTF-8"},
                    "Text": {"Data": text_body, "Charset": "UTF-8"},
                },
            },
        )
        logger.info(
            "Password reset email sent via SES (%s) to %s. MessageId: %s",
            settings.ses_region,
            email,
            response.get("MessageId"),
        )
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "Unknown")
        logger.error("SES failed for %s [%s]: %s", email, code, e)
        if code == "MessageRejected":
            logger.warning(
                "Verify %s in SES (%s) or exit sandbox mode.",
                settings.SES_FROM_EMAIL,
                settings.ses_region,
            )
    except Exception as e:
        logger.error("SES error for %s: %s", email, e)
    return False


def _send_via_smtp(email: str, subject: str, html_body: str, text_body: str) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        return False
    from_email = settings.SMTP_FROM_EMAIL or settings.SES_FROM_EMAIL
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SES_FROM_NAME} <{from_email}>"
        msg["To"] = email
        msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(from_email, [email], msg.as_string())
        logger.info("Password reset email sent via SMTP to %s", email)
        return True
    except Exception as e:
        logger.error("SMTP failed for %s: %s", email, e)
    return False


def send_password_reset_email(email: str, reset_link: str) -> bool:
    """Send password reset email via Resend, SES, or SMTP (first available)."""
    subject, html_body, text_body = _password_reset_bodies(reset_link)

    for sender_name, sender in (
        ("Resend", _send_via_resend),
        ("SES", _send_via_ses),
        ("SMTP", _send_via_smtp),
    ):
        if sender(email, subject, html_body, text_body):
            return True
        logger.info("Password reset: %s unavailable or failed, trying next provider", sender_name)

    logger.warning("All email providers failed. Password reset link for %s: %s", email, reset_link)
    return False


def send_password_reset_confirmation_email(email: str) -> bool:
    """Send password reset confirmation email."""
    subject = "Your Password Has Been Reset"
    html_body = (
        "<p>Your eljiran.io password was reset successfully.</p>"
        "<p>If you did not make this change, contact hello@eljiran.io immediately.</p>"
    )
    text_body = (
        "Your eljiran.io password was reset successfully.\n"
        "If you did not make this change, contact hello@eljiran.io immediately.\n"
    )
    return (
        _send_via_resend(email, subject, html_body, text_body)
        or _send_via_ses(email, subject, html_body, text_body)
        or _send_via_smtp(email, subject, html_body, text_body)
    )
