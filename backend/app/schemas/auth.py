"""Auth schemas."""
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    full_name: str | None
    role: str
    zone_id: int | None
    is_active: bool
    can_create: bool = False
    can_update: bool = False
    can_delete: bool = False


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str | None = None
    password: str = Field(min_length=8)
    role: str = "viewer"
    zone_id: int | None = None
    can_create: bool = False
    can_update: bool = False
    can_delete: bool = False
