"""
routers/contacts.py — HTTP endpoints for contacts.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from models.contact import ContactCreate, ContactResponse, ContactUpdate
from services import contact_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=list[ContactResponse])
def list_contacts(
    is_active: Optional[bool] = Query(None),
    contact_type: Optional[str] = Query(None),
):
    return contact_service.list_contacts(is_active=is_active, contact_type=contact_type)


@router.post("/", response_model=ContactResponse, status_code=201)
def create_contact(data: ContactCreate):
    return contact_service.create_contact(data)


@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: str):
    contact = contact_service.get_contact(contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(contact_id: str, data: ContactUpdate):
    return contact_service.update_contact(contact_id, data)
