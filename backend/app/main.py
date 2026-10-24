from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import Base, engine
from app.routers import auth, transactions, budgets, goals, dashboard

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Creates tables for this starter. Use Alembic migrations for production.
    Base.metadata.create_all(bind=engine)
    yield

app = FastAPI(title="AI-Powered Personal Finance API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins,
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(budgets.router)
app.include_router(goals.router)
app.include_router(dashboard.router)

@app.get("/")
def root():
    return {"message": "Personal Finance API is running", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok"}