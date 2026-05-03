"""
config.py - Application settings loaded from environment variables.

All secrets come from .env (local) or environment (production).
Never hardcode values here.
"""

from typing import Optional, Union

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    supabase_url: str
    supabase_key: str

    app_env: str = "development"
    log_level: str = "INFO"

    # Comma-separated allowed CORS origins, e.g. http://localhost:3000,https://demo.jalite.com
    allowed_origins: list[str] = ["http://localhost:3000"]

    # When set, all routes except GET /health require X-API-Key: <value>
    demo_api_key: Optional[str] = None

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, list]) -> list:
        if isinstance(v, list):
            return v
        return [origin.strip() for origin in v.split(",") if origin.strip()]

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