"""
services/contact_service.py — Database operations for contacts.
"""

from typing import Optional

from database import supabase
from models.contact import ContactCreate, ContactUpdate

TABLE = "contacts"


def list_contacts(is_active: Optional[bool] = None, contact_type: Optional[str] = None) -> list:
    query = supabase.table(TABLE).select("*").order("name")
    if is_active is not None:
        query = query.eq("is_active", is_active)
    if contact_type:
        query = query.eq("contact_type", contact_type)
    return query.execute().data


def get_contact(contact_id: str) -> Optional[dict]:
    response = supabase.table(TABLE).select("*").eq("id", contact_id).execute()
    if not response.data:
        return None
    return response.data[0]


def create_contact(data: ContactCreate) -> dict:
    payload = data.model_dump(mode="json", exclude_none=True)
    return supabase.table(TABLE).insert(payload).execute().data[0]


def update_contact(contact_id: str, data: ContactUpdate) -> dict:
    payload = data.model_dump(mode="json", exclude_unset=True)
    return supabase.table(TABLE).update(payload).eq("id", contact_id).execute().data[0]
