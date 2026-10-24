from decimal import Decimal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, and_
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Budget, Transaction, User
from app.schemas import BudgetIn, BudgetOut
from app.security import get_current_user

router = APIRouter(prefix="/api/budgets", tags=["Budgets"])

def spent_for(db: Session, user_id: int, category: str, month: str) -> Decimal:
    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    end = date(year + (mon == 12), 1 if mon == 12 else mon + 1, 1)
    value = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user_id, Transaction.type == "expense",
        func.lower(Transaction.category) == category.lower(),
        Transaction.transaction_date >= start, Transaction.transaction_date < end
    ))
    return Decimal(str(value or 0))

@router.get("")
def list_budgets(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    budgets = db.scalars(select(Budget).where(Budget.user_id == user.id).order_by(Budget.month.desc(), Budget.category))
    result = []
    for b in budgets:
        spent = spent_for(db, user.id, b.category, b.month)
        limit = Decimal(str(b.monthly_limit))
        result.append({"id": b.id, "category": b.category, "monthly_limit": limit, "month": b.month,
                       "spent": spent, "remaining": limit - spent, "percent_used": round(float(spent / limit * 100), 1)})
    return result

@router.post("", response_model=BudgetOut, status_code=201)
def create_budget(payload: BudgetIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.scalar(select(Budget).where(Budget.user_id == user.id, Budget.category == payload.category,
                                               Budget.month == payload.month))
    if existing:
        raise HTTPException(status_code=409, detail="A budget for this category and month already exists")
    item = Budget(**payload.model_dump(), user_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{budget_id}", response_model=BudgetOut)
def update_budget(budget_id: int, payload: BudgetIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Budget not found")
    duplicate = db.scalar(select(Budget).where(Budget.user_id == user.id, Budget.category == payload.category,
                                                Budget.month == payload.month, Budget.id != budget_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="A budget for this category and month already exists")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{budget_id}", status_code=204)
def delete_budget(budget_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(Budget).where(Budget.id == budget_id, Budget.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(item)
    db.commit()