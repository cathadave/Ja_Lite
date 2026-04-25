"""
config.py - Application settings loaded from environment variables.

All secrets come from .env (local) or environment (production).
Never hardcode values here.
"""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    supabase_url: str
    supabase_key: str

    app_env: str = "development"
    log_level: str = "INFO"

    sms_account_sid: Optional[str] = None
    sms_auth_token: Optional[str] = None
    sms_from_number: Optional[str] = None
    sms_timeout_seconds: float = 10.0

    email_api_key: Optional[str] = None
    email_from_address: Optional[str] = None
    email_api_url: str = "https://api.resend.com/emails"
    email_timeout_seconds: float = 10.0

    demo_mode: bool = False
    demo_phone_number: Optional[str] = None
    demo_email_address: Optional[str] = None


settings = Settings()