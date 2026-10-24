def register_and_auth(client):
    response = client.post("/api/auth/register", json={
        "name": "Test User", "email": "test@example.com", "password": "safe-password-123"
    })
    assert response.status_code == 201, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}

def test_register_transaction_dashboard(client):
    headers = register_and_auth(client)
    response = client.post("/api/transactions", headers=headers, json={
        "amount": "25000.00", "type": "income", "category": "Salary",
        "description": "Monthly salary", "transaction_date": "2026-10-01"
    })
    assert response.status_code == 201, response.text
    response = client.get("/api/transactions", headers=headers)
    assert response.status_code == 200
    assert len(response.json()) == 1

def test_user_data_is_private(client):
    headers = register_and_auth(client)
    other = client.post("/api/auth/register", json={
        "name": "Other User", "email": "other@example.com", "password": "safe-password-456"
    })
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    client.post("/api/transactions", headers=headers, json={
        "amount": "100", "type": "expense", "category": "Food",
        "description": "Lunch", "transaction_date": "2026-10-01"
    })
    assert client.get("/api/transactions", headers=other_headers).json() == []

def test_budget_and_goal(client):
    headers = register_and_auth(client)
    b = client.post("/api/budgets", headers=headers, json={
        "category": "Food", "monthly_limit": "3000", "month": "2026-10"
    })
    assert b.status_code == 201, b.text
    g = client.post("/api/goals", headers=headers, json={
        "name": "Laptop", "target_amount": "50000", "current_amount": "5000", "target_date": "2027-05-01"
    })
    assert g.status_code == 201, g.text