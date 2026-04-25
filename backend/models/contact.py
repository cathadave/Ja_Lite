"""
models/contact.py — Pydantic models for contacts (subcontractors, suppliers, etc.).
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ContactType(str, Enum):
    subcontractor = "subcontractor"
    supplier = "supplier"
    employee = "employee"
    client = "client"
    other = "other"


class ContactMethod(str, Enum):
    sms = "sms"
    email = "email"
    phone = "phone"
    whatsapp = "whatsapp"


class ContactBase(BaseModel):
    name: str
    company: Optional[str] = None
    contact_type: ContactType = ContactType.other
    phone: Optional[str] = None
    email: Optional[str] = None
    preferred_contact_method: ContactMethod = ContactMethod.sms
    notes: Optional[str] = None
    trade: Optional[str] = None
    sub_role: Optional[str] = None
    is_active: bool = True


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    contact_type: Optional[ContactType] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    preferred_contact_method: Optional[ContactMethod] = None
    notes: Optional[str] = None
    trade: Optional[str] = None
    sub_role: Optional[str] = None
    is_active: Optional[bool] = None


class ContactResponse(ContactBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
