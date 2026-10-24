# AI-Powered Personal Finance and Expense Management System

A full-stack starter project using React + Vite, FastAPI, SQLAlchemy, and PostgreSQL.
It includes registration/login, transactions, budgets, savings goals, dashboard summaries,
CSV import, reports, and rule-based financial insights. The AI module is deliberately
provider-independent: you can later connect an LLM API without exposing its key to the browser.

## Requirements
- Python 3.11+
- Node.js 20+
- Docker Desktop (recommended for PostgreSQL), or a local PostgreSQL installation

## 1. Start PostgreSQL
From the project root:
```bash
docker compose up -d db