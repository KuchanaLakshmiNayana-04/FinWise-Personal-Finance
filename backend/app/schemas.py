from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TransactionIn(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    type: Literal["income", "expense"]
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=255)
    transaction_date: date

class TransactionOut(TransactionIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class BudgetIn(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    monthly_limit: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")

class BudgetOut(BudgetIn):
    id: int
    model_config = ConfigDict(from_attributes=True)

class GoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    current_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    target_date: date | None = None

class GoalOut(GoalIn):
    id: int
    model_config = ConfigDict(from_attributes=True)