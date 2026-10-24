import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import api from "./api";

const money = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(n || 0));
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const COLORS = ["#6c63ff", "#19b7a0", "#f59e0b", "#f472b6", "#60a5fa", "#a3e635", "#fb7185"];

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  async function submit(e) {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const { data } = await api.post(url, form);
      localStorage.setItem("finance_token", data.access_token);
      onAuth(data.user);
    } catch (err) {
      setError(err.response?.data?.detail || "Could not connect to the API. Check that the backend is running.");
    } finally { setBusy(false); }
  }
  return <div className="auth-page">
    <div className="auth-art">
      <div className="brand"><span className="brand-icon">F</span> FinWise</div>
      <div className="auth-message"><p className="eyebrow">YOUR MONEY, MADE CLEAR</p><h1>Make confident<br/>financial decisions.</h1><p>Understand your spending, build healthy habits, and make every rupee count.</p>
        <div className="mini-stat"><span className="mini-dot"/><span>One clear view of your finances</span></div>
      </div>
      <div className="auth-footer">Personal finance, thoughtfully organized.</div>
    </div>
    <div className="auth-form-wrap"><form className="auth-form" onSubmit={submit}>
      <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
      <h2>{mode === "login" ? "Sign in to FinWise" : "Create your account"}</h2>
      <p className="muted">{mode === "login" ? "Your financial overview is waiting." : "Start building a clearer picture of your money."}</p>
      {mode === "register" && <label>Full name<input name="name" value={form.name} onChange={change} required minLength="2" placeholder="Your name"/></label>}
      <label>Email address<input name="email" type="email" value={form.email} onChange={change} required placeholder="you@example.com"/></label>
      <label>Password<input name="password" type="password" value={form.password} onChange={change} required minLength="8" placeholder="At least 8 characters"/></label>
      {error && <div className="alert error">{error}</div>}
      <button className="primary-btn full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
      <p className="switch-auth">{mode === "login" ? "New to FinWise?" : "Already have an account?"} <button type="button" className="link-btn" onClick={() => {setMode(mode === "login" ? "register" : "login");setError("");}}>{mode === "login" ? "Create an account" : "Sign in"}</button></p>
      <p className="small muted">Demo finance tracker. Do not enter bank credentials.</p>
    </form></div>
  </div>;
}

function Modal({ title, onClose, children }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose}>×</button></div>{children}</div></div>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("Overview");
  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [insights, setInsights] = useState(null);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState("");
  const [editing, setEditing] = useState(null);
  const [filterMonth, setFilterMonth] = useState(thisMonth());
  const [search, setSearch] = useState("");
  const [txnForm, setTxnForm] = useState({ amount: "", type: "expense", category: "Food", description: "", transaction_date: today() });
  const [budgetForm, setBudgetForm] = useState({ category: "Food", monthly_limit: "", month: thisMonth() });
  const [goalForm, setGoalForm] = useState({ name: "", target_amount: "", current_amount: "0", target_date: "" });

  const logout = useCallback(() => {
    localStorage.removeItem("finance_token"); setUser(null); setDashboard(null);
    setTransactions([]); setBudgets([]); setGoals([]); setInsights(null);
  }, []);

  const loadData = useCallback(async () => {
    if (!localStorage.getItem("finance_token")) return;
    setLoading(true);
    try {
      const [me, dash, tx, bs, gs, ins] = await Promise.all([
        api.get("/api/auth/me"), api.get("/api/dashboard"), api.get("/api/transactions"),
        api.get("/api/budgets"), api.get("/api/goals"), api.get("/api/ai/insights")
      ]);
      setUser(me.data); setDashboard(dash.data); setTransactions(tx.data); setBudgets(bs.data); setGoals(gs.data); setInsights(ins.data);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else setNotice(err.response?.data?.detail || "Could not load data. Is the backend available?");
    } finally { setLoading(false); }
  }, [logout]);

  useEffect(() => { loadData(); }, [loadData]);

  async function runAction(action, successMessage) {
    setNotice("");
    try { await action(); await loadData(); setModal(""); setEditing(null); setNotice(successMessage); }
    catch (err) { setNotice(err.response?.data?.detail || "Action failed. Please check the entered values."); }
  }

  function openTransaction(item = null) {
    setEditing(item);
    setTxnForm(item ? { amount: String(item.amount), type: item.type, category: item.category, description: item.description || "", transaction_date: item.transaction_date } :
      { amount: "", type: "expense", category: "Food", description: "", transaction_date: today() });
    setModal("transaction");
  }
  function openBudget(item = null) {
    setEditing(item);
    setBudgetForm(item ? { category: item.category, monthly_limit: String(item.monthly_limit), month: item.month } : { category: "Food", monthly_limit: "", month: thisMonth() });
    setModal("budget");
  }
  function openGoal(item = null) {
    setEditing(item);
    setGoalForm(item ? { name: item.name, target_amount: String(item.target_amount), current_amount: String(item.current_amount), target_date: item.target_date || "" } : { name: "", target_amount: "", current_amount: "0", target_date: "" });
    setModal("goal");
  }

  async function saveTransaction(e) {
    e.preventDefault();
    const payload = { ...txnForm, amount: Number(txnForm.amount) };
    await runAction(() => editing ? api.put(`/api/transactions/${editing.id}`, payload) : api.post("/api/transactions", payload), editing ? "Transaction updated." : "Transaction added.");
  }
  async function saveBudget(e) {
    e.preventDefault();
    const payload = { ...budgetForm, monthly_limit: Number(budgetForm.monthly_limit) };
    await runAction(() => editing ? api.put(`/api/budgets/${editing.id}`, payload) : api.post("/api/budgets", payload), editing ? "Budget updated." : "Budget created.");
  }
  async function saveGoal(e) {
    e.preventDefault();
    const payload = { ...goalForm, target_amount: Number(goalForm.target_amount), current_amount: Number(goalForm.current_amount), target_date: goalForm.target_date || null };
    await runAction(() => editing ? api.put(`/api/goals/${editing.id}`, payload) : api.post("/api/goals", payload), editing ? "Savings goal updated." : "Savings goal created.");
  }
  async function deleteItem(kind, id) {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    const endpoint = kind === "transaction" ? "transactions" : kind === "budget" ? "budgets" : "goals";
    await runAction(() => api.delete(`/api/${endpoint}/${id}`), "Item deleted.");
  }
  async function askAssistant(e) {
    e.preventDefault();
    if (!aiQuestion.trim()) return;
    setAiBusy(true); setAiAnswer("");
    try {
      const { data } = await api.post("/api/ai/ask", { question: aiQuestion.trim() });
      setAiAnswer(data.answer);
    } catch (err) {
      setAiAnswer(err.response?.data?.detail || "Could not get an answer. Please try again.");
    } finally { setAiBusy(false); }
  }

  async function importFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append("file", file);
    await runAction(async () => {
      const { data } = await api.post("/api/transactions/import-csv", form, { headers: { "Content-Type": "multipart/form-data" } });
      setNotice(`Imported ${data.imported} transaction(s). Skipped duplicates: ${data.skipped_duplicates}. Row errors: ${data.errors.length}.`);
    }, "CSV processed.");
    e.target.value = "";
  }

  const filteredTransactions = useMemo(() => transactions.filter(t =>
    (!filterMonth || t.transaction_date.startsWith(filterMonth)) &&
    `${t.description} ${t.category} ${t.type}`.toLowerCase().includes(search.toLowerCase())
  ), [transactions, filterMonth, search]);

  if (!user) return <AuthScreen onAuth={(u) => {setUser(u); loadData();}}/>;

  const nav = [
    { name: "Overview", icon: "◫", group: "WORKSPACE" },
    { name: "Transactions", icon: "↔", group: "WORKSPACE" },
    { name: "Budgets", icon: "▤", group: "WORKSPACE" },
    { name: "Savings goals", icon: "◎", group: "WORKSPACE" },
    { name: "Reports & AI", icon: "⌁", group: "INSIGHTS" },
  ];
  const displayName = user.name?.split(" ")[0] || "there";

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-icon">F</span> FinWise</div>
      <div className="side-label">WORKSPACE</div>
      {nav.filter(n => n.group === "WORKSPACE").map(n => <button key={n.name} className={`nav-item ${page === n.name ? "active" : ""}`} onClick={() => setPage(n.name)}><span className="nav-icon">{n.icon}</span>{n.name}</button>)}
      <div className="side-label insight-label">INSIGHTS</div>
      {nav.filter(n => n.group === "INSIGHTS").map(n => <button key={n.name} className={`nav-item ${page === n.name ? "active" : ""}`} onClick={() => setPage(n.name)}><span className="nav-icon">{n.icon}</span>{n.name}</button>)}
      <div className="sidebar-spacer"/>
      <div className="help-card"><div className="help-icon">✦</div><strong>Your money, in focus</strong><p>Small steps today build better habits tomorrow.</p></div>
      <div className="user-profile"><div className="avatar">{user.name?.[0]?.toUpperCase() || "U"}</div><div className="user-meta"><strong>{user.name}</strong><span>{user.email}</span></div><button title="Log out" className="icon-btn logout" onClick={logout}>↪</button></div>
    </aside>

    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="top-actions"><span className="status-dot"/> All data synced <button className="avatar small-avatar" title={user.name}>{user.name?.[0]?.toUpperCase()}</button></div></header>
      <div className="page-container">
        {notice && <div className="alert notice">{notice}<button className="notice-close" onClick={() => setNotice("")}>×</button></div>}
        {loading && <div className="loading-line">Refreshing your financial overview…</div>}

        {page === "Overview" && <>
          <div className="page-heading"><div><p className="eyebrow">YOUR FINANCIAL OVERVIEW</p><h1>Good day, {displayName} <span className="wave">✦</span></h1><p className="muted">Here's what's happening with your money this month.</p></div><button className="primary-btn" onClick={() => openTransaction()}>＋ Add transaction</button></div>
          <div className="stat-grid">
            <StatCard title="Total income" value={money(dashboard?.income)} icon="↙" tone="green" foot="This calendar month"/>
            <StatCard title="Total expenses" value={money(dashboard?.expenses)} icon="↗" tone="rose" foot="This calendar month"/>
            <StatCard title="Available balance" value={money(dashboard?.balance)} icon="◈" tone="purple" foot="Income minus expenses"/>
            <StatCard title="Savings rate" value={`${dashboard?.savings_rate ?? 0}%`} icon="◎" tone="amber" foot="Based on this month's totals"/>
          </div>
          <div className="content-grid">
            <section className="panel chart-panel"><div className="panel-heading"><div><h3>Spending by category</h3><p className="muted">Where your money went this month</p></div><span className="pill">{dashboard?.month || thisMonth()}</span></div>
              {dashboard?.expenses_by_category?.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.expenses_by_category} margin={{top:10,right:8,left:0,bottom:5}}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5"/><XAxis dataKey="category" tick={{fontSize:11,fill:"#8790a2"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:"#8790a2"}} axisLine={false} tickLine={false} width={58}/><Tooltip formatter={(v)=>money(v)}/><Bar dataKey="amount" fill="#7167f8" radius={[6,6,0,0]} maxBarSize={46}/></BarChart></ResponsiveContainer></div> : <Empty text="Add expenses to see your spending chart."/>}
            </section>
            <section className="panel insights-panel"><div className="panel-heading"><div><h3><span className="sparkle">✦</span> Smart insights</h3><p className="muted">Helpful observations from your records</p></div></div>
              <div className="insight-list">{(insights?.insights || ["Add transactions to start seeing insights."]).map((s,i)=><div className="insight-item" key={i}><span className="insight-bullet">{i+1}</span><p>{s}</p></div>)}</div>
              <button className="text-action" onClick={() => setPage("Reports & AI")}>Explore reports <span>→</span></button>
            </section>
          </div>
          <section className="panel"><div className="panel-heading"><div><h3>Recent transactions</h3><p className="muted">Your latest financial activity</p></div><button className="text-action" onClick={() => setPage("Transactions")}>View all →</button></div><TransactionTable items={dashboard?.recent_transactions || []} compact/></section>
        </>}

        {page === "Transactions" && <><div className="page-heading"><div><p className="eyebrow">MONEY IN, MONEY OUT</p><h1>Transactions</h1><p className="muted">Keep your financial activity organized.</p></div><button className="primary-btn" onClick={() => openTransaction()}>＋ Add transaction</button></div>
          <section className="panel"><div className="toolbar"><input className="search-input" placeholder="Search description or category…" value={search} onChange={e => setSearch(e.target.value)}/><input aria-label="Filter month" type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}/><button className="secondary-btn" onClick={() => {setFilterMonth("");setSearch("");}}>Clear filters</button><label className="secondary-btn upload-btn">↑ Import CSV<input type="file" accept=".csv,text/csv" onChange={importFile}/></label></div><TransactionTable items={filteredTransactions} onEdit={openTransaction} onDelete={id => deleteItem("transaction",id)}/><p className="small muted csv-help">CSV headers: date, description, amount, type, category. Date format: YYYY-MM-DD.</p></section>
        </>}

        {page === "Budgets" && <><div className="page-heading"><div><p className="eyebrow">PLAN WITH PURPOSE</p><h1>Monthly budgets</h1><p className="muted">Give every spending category a clear limit.</p></div><button className="primary-btn" onClick={() => openBudget()}>＋ Create budget</button></div>
          <div className="budget-grid">{budgets.map(b=><div className="panel budget-card" key={b.id}><div className="budget-card-head"><span className="category-icon">{b.category.slice(0,1).toUpperCase()}</span><button className="icon-btn" onClick={() => openBudget(b)}>✎</button></div><p className="muted small">{b.month}</p><h3>{b.category}</h3><div className="budget-numbers"><strong>{money(b.spent)}</strong><span>of {money(b.monthly_limit)}</span></div><div className="progress"><span style={{width:`${Math.min(100,Math.max(0,b.percent_used))}%`,background:b.percent_used>=100?"#ef647c":b.percent_used>=80?"#f2ae48":"#7167f8"}}/></div><p className={`budget-foot ${b.percent_used>=100?"danger":b.percent_used>=80?"warning":""}`}>{b.percent_used.toFixed(1)}% used · {money(b.remaining)} remaining</p><button className="delete-link" onClick={() => deleteItem("budget",b.id)}>Delete budget</button></div>)}
          {!budgets.length && <div className="panel empty-panel"><Empty text="No budgets yet. Create a category budget to get started."/></div>}</div>
        </>}

        {page === "Savings goals" && <><div className="page-heading"><div><p className="eyebrow">YOUR FUTURE, PLANNED</p><h1>Savings goals</h1><p className="muted">Turn your plans into progress.</p></div><button className="primary-btn" onClick={() => openGoal()}>＋ New goal</button></div>
          <div className="goal-grid">{goals.map(g=>{const pct=Math.min(100,Number(g.current_amount)/Number(g.target_amount)*100);return <div className="panel goal-card" key={g.id}><div className="goal-symbol">◎</div><div className="goal-actions"><button className="icon-btn" onClick={() => openGoal(g)}>✎</button><button className="icon-btn" onClick={() => deleteItem("goal",g.id)}>×</button></div><h3>{g.name}</h3><p className="muted small">{g.target_date ? `Target date: ${g.target_date}` : "No target date set"}</p><div className="goal-amount">{money(g.current_amount)} <span>of {money(g.target_amount)}</span></div><div className="progress"><span style={{width:`${pct}%`}}/></div><p className="budget-foot">{pct.toFixed(1)}% of your goal</p></div>})}
          {!goals.length && <div className="panel empty-panel"><Empty text="Create your first savings goal."/></div>}</div>
        </>}

        {page === "Reports & AI" && <><div className="page-heading"><div><p className="eyebrow">UNDERSTAND YOUR HABITS</p><h1>Reports & insights</h1><p className="muted">A clearer view of your financial patterns.</p></div><input className="month-picker" type="month" value={filterMonth || thisMonth()} onChange={e => setFilterMonth(e.target.value)}/></div>
          <div className="stat-grid report-stats"><StatCard title="Income" value={money(dashboard?.income)} icon="↙" tone="green" foot="Current month dashboard"/><StatCard title="Expenses" value={money(dashboard?.expenses)} icon="↗" tone="rose" foot="Current month dashboard"/><StatCard title="Savings rate" value={`${dashboard?.savings_rate ?? 0}%`} icon="◎" tone="purple" foot="Current month dashboard"/></div>
          <div className="content-grid"><section className="panel"><div className="panel-heading"><div><h3>Expense distribution</h3><p className="muted">Category share for current month</p></div></div>
            {dashboard?.expenses_by_category?.length ? <div className="pie-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={dashboard.expenses_by_category} dataKey="amount" nameKey="category" innerRadius={65} outerRadius={100} paddingAngle={3}>{dashboard.expenses_by_category.map((x,i)=><Cell key={x.category} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip formatter={v=>money(v)}/></PieChart></ResponsiveContainer></div> : <Empty text="Add expenses to build your report."/>}
            <div className="legend">{(dashboard?.expenses_by_category||[]).map((x,i)=><div key={x.category}><span style={{background:COLORS[i%COLORS.length]}}/>{x.category}<strong>{money(x.amount)}</strong></div>)}</div>
          </section><section className="panel"><div className="panel-heading"><div><h3><span className="sparkle">✦</span> Spending observations</h3><p className="muted">Generated from your recorded data</p></div></div><div className="insight-list">{(insights?.insights||[]).map((s,i)=><div className="insight-item" key={i}><span className="insight-bullet">{i+1}</span><p>{s}</p></div>)}</div><div className="ai-note"><strong>About these insights</strong><p>Insights use your actual transaction totals. Configure OPENAI_API_KEY in the backend .env to enable the optional LLM assistant; without it, the assistant uses a local summary.</p></div>
            <form className="assistant-form" onSubmit={askAssistant}><label htmlFor="ai-question">Ask about your finances</label><textarea id="ai-question" rows="3" maxLength="500" value={aiQuestion} onChange={e=>setAiQuestion(e.target.value)} placeholder="e.g. What is my biggest expense this month?"/><button className="primary-btn" disabled={aiBusy || !aiQuestion.trim()}>{aiBusy ? "Thinking…" : "Ask assistant"}</button>{aiAnswer && <div className="assistant-answer"><strong>Assistant</strong><p>{aiAnswer}</p></div>}</form></section></div>
        </>}
      </div>
    </main>

    {modal === "transaction" && <Modal title={editing ? "Edit transaction" : "Add transaction"} onClose={() => setModal("")}><form className="form-grid" onSubmit={saveTransaction}>
      <label>Transaction type<select value={txnForm.type} onChange={e=>setTxnForm({...txnForm,type:e.target.value})}><option value="expense">Expense</option><option value="income">Income</option></select></label>
      <label>Amount (₹)<input type="number" min="0.01" step="0.01" required value={txnForm.amount} onChange={e=>setTxnForm({...txnForm,amount:e.target.value})}/></label>
      <label>Category<input required maxLength="80" value={txnForm.category} onChange={e=>setTxnForm({...txnForm,category:e.target.value})} placeholder="Food, Salary…"/></label>
      <label>Date<input type="date" required value={txnForm.transaction_date} onChange={e=>setTxnForm({...txnForm,transaction_date:e.target.value})}/></label>
      <label className="span-2">Description<input maxLength="255" value={txnForm.description} onChange={e=>setTxnForm({...txnForm,description:e.target.value})} placeholder="What was this transaction for?"/></label>
      <div className="form-actions span-2"><button type="button" className="secondary-btn" onClick={()=>setModal("")}>Cancel</button><button className="primary-btn">{editing ? "Save changes" : "Add transaction"}</button></div>
    </form></Modal>}

    {modal === "budget" && <Modal title={editing ? "Edit budget" : "Create budget"} onClose={() => setModal("")}><form className="form-grid" onSubmit={saveBudget}>
      <label>Category<input required maxLength="80" value={budgetForm.category} onChange={e=>setBudgetForm({...budgetForm,category:e.target.value})}/></label>
      <label>Monthly limit (₹)<input type="number" min="0.01" step="0.01" required value={budgetForm.monthly_limit} onChange={e=>setBudgetForm({...budgetForm,monthly_limit:e.target.value})}/></label>
      <label className="span-2">Budget month<input type="month" required value={budgetForm.month} onChange={e=>setBudgetForm({...budgetForm,month:e.target.value})}/></label>
      <div className="form-actions span-2"><button type="button" className="secondary-btn" onClick={()=>setModal("")}>Cancel</button><button className="primary-btn">Save budget</button></div>
    </form></Modal>}

    {modal === "goal" && <Modal title={editing ? "Edit savings goal" : "Create savings goal"} onClose={() => setModal("")}><form className="form-grid" onSubmit={saveGoal}>
      <label className="span-2">Goal name<input required maxLength="120" value={goalForm.name} onChange={e=>setGoalForm({...goalForm,name:e.target.value})} placeholder="e.g. New laptop"/></label>
      <label>Target amount (₹)<input type="number" min="0.01" step="0.01" required value={goalForm.target_amount} onChange={e=>setGoalForm({...goalForm,target_amount:e.target.value})}/></label>
      <label>Already saved (₹)<input type="number" min="0" step="0.01" required value={goalForm.current_amount} onChange={e=>setGoalForm({...goalForm,current_amount:e.target.value})}/></label>
      <label className="span-2">Target date (optional)<input type="date" value={goalForm.target_date} onChange={e=>setGoalForm({...goalForm,target_date:e.target.value})}/></label>
      <div className="form-actions span-2"><button type="button" className="secondary-btn" onClick={()=>setModal("")}>Cancel</button><button className="primary-btn">Save goal</button></div>
    </form></Modal>}
  </div>;
}

function StatCard({title,value,icon,tone,foot}) {
  return <div className="panel stat-card"><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-foot">{foot}</span></div>;
}
function Empty({text}) { return <div className="empty-state"><span className="empty-icon">◌</span><p>{text}</p></div>; }
function TransactionTable({items=[],onEdit,onDelete,compact=false}) {
  if (!items.length) return <Empty text="No transactions found. Add a transaction to get started."/>;
  return <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Amount</th>{!compact&&<th>Actions</th>}</tr></thead><tbody>{items.map(t=><tr key={t.id}><td><div className="transaction-name"><span className={`txn-icon ${t.type}`}>{t.type==="income"?"↙":"↗"}</span><span><strong>{t.description||t.category}</strong><small>{t.type==="income"?"Money received":"Money spent"}</small></span></div></td><td><span className="category-tag">{t.category}</span></td><td>{t.transaction_date}</td><td className={t.type==="income"?"positive":"negative"}>{t.type==="income"?"+":"−"}{money(t.amount)}</td>{!compact&&<td><div className="row-actions"><button className="icon-btn" title="Edit" onClick={()=>onEdit?.(t)}>✎</button><button className="icon-btn delete-icon" title="Delete" onClick={()=>onDelete?.(t.id)}>×</button></div></td>}</tr>)}</tbody></table></div>;
}