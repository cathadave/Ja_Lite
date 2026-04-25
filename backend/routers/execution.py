from fastapi import APIRouter
from pydantic import BaseModel
from services.execution_service import execute_actions, get_federal_holidays, preview_affected_contacts

router = APIRouter()


class ExecuteRequest(BaseModel):
    actions: list


@router.post("/execute")
def execute(request: ExecuteRequest):
    return execute_actions(request.actions)


@router.post("/preview_contacts")
def preview_contacts_endpoint(request: ExecuteRequest):
    contacts = preview_affected_contacts(request.actions)
    return {"contacts": contacts}


@router.get("/holidays/{year}")
def holidays(year: int):
    return get_federal_holidays(year)
