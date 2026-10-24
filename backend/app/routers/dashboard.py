from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Transaction, Budget, SavingsGoal, User
from app.security import get_current_user

router = APIRouter(prefix="/api", tags=["Dashboard and Reports"])

def month_bounds(month: str):
    year, mon = map(int, month.split("-"))
    start = date(year, mon, 1)
    end = date(year + (mon == 12), 1 if mon == 12 else mon + 1, 1)
    return start, end

@router.get("/dashboard")
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    month = date.today().strftime("%Y-%m")
    start, end = month_bounds(month)
    def total(kind):
        v = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == user.id, Transaction.type == kind,
            Transaction.transaction_date >= start, Transaction.transaction_date < end))
        return Decimal(str(v or 0))
    income, expenses = total("income"), total("expense")
    recent = db.scalars(select(Transaction).where(Transaction.user_id == user.id)
                        .order_by(desc(Transaction.transaction_date), desc(Transaction.id)).limit(6))
    categories = db.execute(select(Transaction.category, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.type == "expense",
               Transaction.transaction_date >= start, Transaction.transaction_date < end)
        .group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc())).all()
    return {"month": month, "income": income, "expenses": expenses, "balance": income - expenses,
            "savings_rate": round(float((income - expenses) / income * 100), 1) if income > 0 else 0,
            "expenses_by_category": [{"category": c, "amount": Decimal(str(a))} for c, a in categories],
            "recent_transactions": [{"id": t.id, "amount": t.amount, "type": t.type, "category": t.category,
                                     "description": t.description, "transaction_date": t.transaction_date}
                                    for t in recent]}

@router.get("/reports/monthly")
def monthly_report(month: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    month = month or date.today().strftime("%Y-%m")
    try:
        start, end = month_bounds(month)
    except (ValueError, TypeError):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="month must be YYYY-MM")
    income = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user.id, Transaction.type == "income",
        Transaction.transaction_date >= start, Transaction.transaction_date < end))
    expenses = db.scalar(select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.user_id == user.id, Transaction.type == "expense",
        Transaction.transaction_date >= start, Transaction.transaction_date < end))
    by_category = db.execute(select(Transaction.category, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.type == "expense",
               Transaction.transaction_date >= start, Transaction.transaction_date < end)
        .group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc())).all()
    return {"month": month, "income": Decimal(str(income or 0)), "expenses": Decimal(str(expenses or 0)),
            "net": Decimal(str(income or 0)) - Decimal(str(expenses or 0)),
            "expenses_by_category": [{"category": c, "amount": Decimal(str(a))} for c, a in by_category]}

@router.get("/ai/insights")
def ai_insights(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Baseline insights are deterministic and use the user's own records.
    # This works without an external AI API and is safe to demo offline.
    month = date.today().strftime("%Y-%m")
    start, end = month_bounds(month)
    rows = db.execute(select(Transaction.category, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.type == "expense",
               Transaction.transaction_date >= start, Transaction.transaction_date < end)
        .group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc())).all()
    total = sum((Decimal(str(a)) for _, a in rows), Decimal("0"))
    insights = []
    if not rows:
        insights.append("Add transactions to receive personalized spending insights.")
    else:
        category, amount = rows[0]
        share = float(Decimal(str(amount)) / total * 100) if total else 0
        insights.append(f"{category} is your largest recorded expense category this month ({share:.1f}% of recorded expenses).")
        if len(rows) >= 2:
            insights.append(f"Your next-largest category is {rows[1][0]}. Review both categories when planning next month's budget.")
        budgets = db.scalars(select(Budget).where(Budget.user_id == user.id, Budget.month == month))
        for b in budgets:
            spent = sum((Decimal(str(a)) for c, a in rows if c.lower() == b.category.lower()), Decimal("0"))
            pct = float(spent / Decimal(str(b.monthly_limit)) * 100)
            if pct >= 100:
                insights.append(f"You have reached or exceeded your {b.category} budget ({pct:.0f}% used).")
            elif pct >= 80:
                insights.append(f"You have used {pct:.0f}% of your {b.category} budget.")
    return {"month": month, "mode": "rule_based_baseline", "insights": insights,
            "note": "These are data-based budgeting observations, not professional financial advice."}


@router.post("/ai/ask")
async def ask_finance_assistant(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Answer a question using only this user's summarized transaction data.
    Uses OpenAI when configured; otherwise returns a useful local summary.
    """
    question = str(payload.get("question", "")).strip()
    if not question or len(question) > 500:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="Question is required and must be at most 500 characters")
    month = date.today().strftime("%Y-%m")
    start, end = month_bounds(month)
    totals = db.execute(select(Transaction.type, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.transaction_date >= start,
               Transaction.transaction_date < end).group_by(Transaction.type)).all()
    totals_map = {kind: str(amount or 0) for kind, amount in totals}
    rows = db.execute(select(Transaction.category, func.sum(Transaction.amount))
        .where(Transaction.user_id == user.id, Transaction.type == "expense",
               Transaction.transaction_date >= start, Transaction.transaction_date < end)
        .group_by(Transaction.category).order_by(func.sum(Transaction.amount).desc()).limit(10)).all()
    summary = {
        "month": month,
        "income": totals_map.get("income", "0"),
        "expenses": totals_map.get("expense", "0"),
        "expense_categories": [{"category": c, "amount": str(a)} for c, a in rows],
    }
    from app.config import settings
    if settings.openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            response = await client.responses.create(
                model=settings.openai_model,
                instructions=(
                    "You are a cautious personal budgeting assistant. Explain the provided summary in plain language. "
                    "Only use facts in the supplied JSON; if it does not answer the question, say so. "
                    "Do not claim to be a financial adviser or recommend investments. Keep the response concise."
                ),
                input=f"User question: {question}\nFinancial summary JSON: {summary}",
                max_output_tokens=250,
            )
            answer = response.output_text
            return {"answer": answer, "mode": "llm", "month": month}
        except Exception:
            # Do not leak provider errors or keys; provide fallback response instead.
            pass
    income = Decimal(summary["income"])
    expenses = Decimal(summary["expenses"])
    top = rows[0] if rows else None
    fallback = f"For {month}, recorded income is {income} and recorded expenses are {expenses}."
    if top:
        fallback += f" Your largest expense category is {top[0]} ({Decimal(str(top[1]))})."
    fallback += " Add more transactions for a more detailed summary. This is budgeting information, not professional financial advice."
    return {"answer": fallback, "mode": "local_fallback", "month": month}