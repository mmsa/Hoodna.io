import boto3
from botocore.exceptions import ClientError
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)


def get_ses_client():
    """Get AWS SES client."""
    return boto3.client(
        'ses',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )


def send_password_reset_email(email: str, reset_link: str) -> bool:
    """
    Send password reset email via AWS SES.
    
    Args:
        email: Recipient email address
        reset_link: Password reset link with token
        
    Returns:
        True if email sent successfully, False otherwise
    """
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        logger.warning("AWS credentials not configured. Email not sent.")
        logger.info(f"Password reset link for {email}: {reset_link}")
        return False
    
    try:
        ses_client = get_ses_client()
        
        subject = "Reset Your Hoodna.io Password"
        
        # HTML email body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .button {{ display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
                .footer {{ margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Hoodna.io</h1>
                </div>
                <div class="content">
                    <h2>Reset Your Password</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Click the button below to reset it:</p>
                    <p style="text-align: center;">
                        <a href="{reset_link}" class="button">Reset Password</a>
                    </p>
                    <p>Or copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; color: #3b82f6;">{reset_link}</p>
                    <p>This link will expire in 1 hour.</p>
                    <p>If you didn't request a password reset, please ignore this email.</p>
                </div>
                <div class="footer">
                    <p>© 2025 Hoodna.io. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text email body
        text_body = f"""
        Reset Your Hoodna.io Password
        
        Hello,
        
        We received a request to reset your password. Click the link below to reset it:
        
        {reset_link}
        
        This link will expire in 1 hour.
        
        If you didn't request a password reset, please ignore this email.
        
        © 2025 Hoodna.io. All rights reserved.
        """
        
        response = ses_client.send_email(
            Source=f"{settings.SES_FROM_NAME} <{settings.SES_FROM_EMAIL}>",
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                }
            }
        )
        
        logger.info(f"Password reset email sent to {email}. MessageId: {response['MessageId']}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"Failed to send password reset email to {email}: {error_code} - {e}")
        
        # If SES is in sandbox mode, log the error but don't fail
        if error_code == 'MessageRejected':
            logger.warning("SES is likely in sandbox mode. Email address must be verified.")
        
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending password reset email to {email}: {e}")
        return False


def send_password_reset_confirmation_email(email: str) -> bool:
    """
    Send password reset confirmation email via AWS SES.
    
    Args:
        email: Recipient email address
        
    Returns:
        True if email sent successfully, False otherwise
    """
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        logger.warning("AWS credentials not configured. Email not sent.")
        return False
    
    try:
        ses_client = get_ses_client()
        
        subject = "Your Password Has Been Reset"
        
        # HTML email body
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
                .content {{ background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }}
                .footer {{ margin-top: 20px; font-size: 12px; color: #6b7280; text-align: center; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Hoodna.io</h1>
                </div>
                <div class="content">
                    <h2>Password Reset Successful</h2>
                    <p>Hello,</p>
                    <p>Your password has been successfully reset.</p>
                    <p>If you did not make this change, please contact support immediately.</p>
                    <p>You can now log in with your new password.</p>
                </div>
                <div class="footer">
                    <p>© 2025 Hoodna.io. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text email body
        text_body = f"""
        Password Reset Successful
        
        Hello,
        
        Your password has been successfully reset.
        
        If you did not make this change, please contact support immediately.
        
        You can now log in with your new password.
        
        © 2025 Hoodna.io. All rights reserved.
        """
        
        response = ses_client.send_email(
            Source=f"{settings.SES_FROM_NAME} <{settings.SES_FROM_EMAIL}>",
            Destination={'ToAddresses': [email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'},
                }
            }
        )
        
        logger.info(f"Password reset confirmation email sent to {email}. MessageId: {response['MessageId']}")
        return True
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"Failed to send confirmation email to {email}: {error_code} - {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending confirmation email to {email}: {e}")
        return False

