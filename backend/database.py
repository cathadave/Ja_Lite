"""
database.py — Supabase client singleton.

Import `supabase` from this module wherever DB access is needed.
The client is created once at startup using credentials from config.
"""

from supabase import create_client, Client
from config import settings


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_key)


# Module-level singleton — reused across all service calls
supabase: Client = get_supabase_client()
