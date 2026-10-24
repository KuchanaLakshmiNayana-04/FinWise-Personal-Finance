from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import SavingsGoal, User
from app.schemas import GoalIn, GoalOut
from app.security import get_current_user

router = APIRouter(prefix="/api/goals", tags=["Savings Goals"])

@router.get("", response_model=list[GoalOut])
def list_goals(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return list(db.scalars(select(SavingsGoal).where(SavingsGoal.user_id == user.id).order_by(SavingsGoal.created_at.desc())))

@router.post("", response_model=GoalOut, status_code=201)
def create_goal(payload: GoalIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if payload.current_amount > payload.target_amount:
        raise HTTPException(status_code=400, detail="Current amount cannot exceed target amount")
    item = SavingsGoal(**payload.model_dump(), user_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(goal_id: int, payload: GoalIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Goal not found")
    if payload.current_amount > payload.target_amount:
        raise HTTPException(status_code=400, detail="Current amount cannot exceed target amount")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{goal_id}", status_code=204)
def delete_goal(goal_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(SavingsGoal).where(SavingsGoal.id == goal_id, SavingsGoal.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(item)
    db.commit()