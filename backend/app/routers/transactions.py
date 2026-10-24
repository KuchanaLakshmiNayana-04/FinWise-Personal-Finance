import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy import select, desc
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Transaction, User
from app.schemas import TransactionIn, TransactionOut
from app.security import get_current_user

router = APIRouter(prefix="/api/transactions", tags=["Transactions"])

@router.get("", response_model=list[TransactionOut])
def list_transactions(
    month: str | None = Query(default=None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
    kind: str | None = Query(default=None, alias="type", pattern="^(income|expense)$"),
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    stmt = select(Transaction).where(Transaction.user_id == user.id)
    if month:
        stmt = stmt.where(Transaction.transaction_date >= date.fromisoformat(month + "-01"))
        year, mon = map(int, month.split("-"))
        next_month = date(year + (mon == 12), 1 if mon == 12 else mon + 1, 1)
        stmt = stmt.where(Transaction.transaction_date < next_month)
    if kind:
        stmt = stmt.where(Transaction.type == kind)
    return list(db.scalars(stmt.order_by(desc(Transaction.transaction_date), desc(Transaction.id))))

@router.post("", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = Transaction(**payload.model_dump(), user_id=user.id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(transaction_id: int, payload: TransactionIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item

@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if not item:
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(item)
    db.commit()

@router.post("/import-csv")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload a .csv file")
    raw = await file.read()
    if len(raw) > 2_000_000:
        raise HTTPException(status_code=413, detail="CSV file must be smaller than 2 MB")
    try:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required = {"date", "description", "amount", "type", "category"}
        if not reader.fieldnames or not required.issubset({x.strip().lower() for x in reader.fieldnames}):
            raise HTTPException(status_code=400, detail="CSV headers must include date,description,amount,type,category")
        # Normalize headers so header capitalization does not matter.
        reader.fieldnames = [x.strip().lower() for x in reader.fieldnames]
        imported, skipped, errors = 0, 0, []
        seen = set()
        for line_no, row in enumerate(reader, start=2):
            try:
                kind = (row.get("type") or "").strip().lower()
                amount = Decimal((row.get("amount") or "").strip())
                txn_date = date.fromisoformat((row.get("date") or "").strip())
                category = (row.get("category") or "").strip()
                description = (row.get("description") or "").strip()
                if kind not in ("income", "expense") or amount <= 0 or not category:
                    raise ValueError("type must be income/expense, amount positive, category required")
                key = (txn_date, description, amount, kind, category)
                if key in seen:
                    skipped += 1
                    continue
                seen.add(key)
                db.add(Transaction(user_id=user.id, transaction_date=txn_date, description=description[:255],
                                   amount=amount, type=kind, category=category[:80]))
                imported += 1
            except (ValueError, InvalidOperation, TypeError) as exc:
                errors.append({"line": line_no, "error": str(exc)})
            if len(errors) >= 20:
                break
        db.commit()
        return {"imported": imported, "skipped_duplicates": skipped, "errors": errors}
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="CSV must be UTF-8 encoded")