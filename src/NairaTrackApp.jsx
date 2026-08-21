import React, { useState, useEffect } from "react";

// Accept either the full transactions URL or the deployed backend origin.
const RAW_API_URL = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/transactions"
).replace(/\/+$/, "");
const API_ROOT = RAW_API_URL.replace(/\/transactions\/?$/, "");
const BASE_API_URL = API_ROOT.endsWith("/api") ? API_ROOT : `${API_ROOT}/api`;
const TRANSACTIONS_URL = `${BASE_API_URL}/transactions`;
const AUTH_URL = `${BASE_API_URL}/auth`;

export default function NairaTrackApp() {
  // Authentication State
  const [token, setToken] = useState(
    () => localStorage.getItem("nairatrack_token") || "",
  );
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("nairatrack_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Auth Form State
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'register'
  const [authName, setAuthName] = useState("");
  const [authBusinessName, setAuthBusinessName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // App Navigation & Data State
  const [activeTab, setActiveTab] = useState("dashboard");
  const [transactions, setTransactions] = useState([]);

  // Dynamic categories state: isolated per user
  const [categories, setCategories] = useState(() => {
    const userId = currentUser ? currentUser.id : "default";
    const saved = localStorage.getItem(`nairatrack_categories_${userId}`);
    return saved ?
        JSON.parse(saved)
      : ["Sales", "Rent & Utilities", "Inventory", "Payroll", "Logistics"];
  });

  // Dynamic monthly budgets state: isolated per user
  const [budgets, setBudgets] = useState(() => {
    const userId = currentUser ? currentUser.id : "default";
    const saved = localStorage.getItem(`nairatrack_budgets_${userId}`);
    return saved ? JSON.parse(saved) : {};
  });

  // Modal display state
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Timeframe filter state on Dashboard
  const [timeframe, setTimeframe] = useState("all");

  // Search & Filter states on Entries tab
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterCategory, setFilterCategory] = useState("All");

  // Transaction Form State
  const [type, setType] = useState("Expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");

  // Category management form input state
  const [newCategory, setNewCategory] = useState("");

  // Persist categories per user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        `nairatrack_categories_${currentUser.id}`,
        JSON.stringify(categories),
      );
    }
  }, [categories, currentUser]);

  // Persist budgets per user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        `nairatrack_budgets_${currentUser.id}`,
        JSON.stringify(budgets),
      );
    }
  }, [budgets, currentUser]);

  // Update categories and budgets when switching user
  useEffect(() => {
    if (currentUser) {
      const savedCats = localStorage.getItem(
        `nairatrack_categories_${currentUser.id}`,
      );
      setCategories(
        savedCats ?
          JSON.parse(savedCats)
        : ["Sales", "Rent & Utilities", "Inventory", "Payroll", "Logistics"],
      );

      const savedBudgets = localStorage.getItem(
        `nairatrack_budgets_${currentUser.id}`,
      );
      setBudgets(savedBudgets ? JSON.parse(savedBudgets) : {});
    }
  }, [currentUser]);

  // Set default category to the first one available
  useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  // Safe fetch helper that handles non-JSON / HTML errors gracefully
  const safeFetch = async (url, options = {}) => {
    let res;
    try {
      res = await fetch(url, options);
    } catch (networkErr) {
      throw new Error(
        `Cannot connect to server at ${url}. Please ensure your local backend is running (cd nairatrack-backend-main && npm start).`,
      );
    }

    let data = {};
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await res.json();
    } else {
      const text = await res.text();
      if (!res.ok) {
        throw new Error(
          `Server returned status ${res.status}: Check if the backend is running on ${BASE_API_URL}`,
        );
      }
    }

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }

    return data;
  };

  // Fetch transactions for authenticated user
  const fetchTransactions = async () => {
    if (!token) return;
    try {
      const res = await fetch(TRANSACTIONS_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTransactions(data);
        }
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTransactions();
    } else {
      setTransactions([]);
    }
  }, [token]);

  // ============================================
  // AUTH HANDLERS
  // ============================================

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const data = await safeFetch(`${AUTH_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: authName,
          businessName: authBusinessName || "My Business",
          email: authEmail,
          password: authPassword,
        }),
      });

      // Save token and user profile
      localStorage.setItem("nairatrack_token", data.token);
      localStorage.setItem("nairatrack_user", JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      setAuthPassword("");
      setActiveTab("dashboard");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const data = await safeFetch(`${AUTH_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
        }),
      });

      // Save token and user profile
      localStorage.setItem("nairatrack_token", data.token);
      localStorage.setItem("nairatrack_user", JSON.stringify(data.user));
      setToken(data.token);
      setCurrentUser(data.user);
      setAuthPassword("");
      setActiveTab("dashboard");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("nairatrack_token");
    localStorage.removeItem("nairatrack_user");
    setToken("");
    setCurrentUser(null);
    setTransactions([]);
    setActiveTab("dashboard");
  };

  // Helper to get local date string YYYY-MM-DD
  const getLocalDateStr = () => {
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    const localDate = new Date(Date.now() - tzoffset);
    return localDate.toISOString().split("T")[0];
  };

  // Open modal and prefill default values
  const openModal = () => {
    if (categories.length > 0) {
      setCategory(categories[0]);
    }
    setDate(getLocalDateStr());
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTitle("");
    setAmount("");
    setType("Expense");
  };

  // Add a new transaction (POST)
  const handleAddTransaction = async (e) => {
    e.preventDefault();
    if (!title || !amount || !category || !date) return;

    const newTransaction = {
      title,
      amount: parseFloat(amount),
      type,
      category,
      date,
    };

    try {
      const savedDoc = await safeFetch(TRANSACTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTransaction),
      });

      setTransactions([savedDoc, ...transactions]);
      closeModal();
    } catch (err) {
      alert(`Could not add transaction: ${err.message}`);
    }
  };

  // Delete a transaction (DELETE)
  const handleDeleteTransaction = async (id) => {
    try {
      await safeFetch(`${TRANSACTIONS_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setTransactions(transactions.filter((t) => t._id !== id));
    } catch (err) {
      alert(`Could not delete transaction: ${err.message}`);
    }
  };

  // Add a custom category
  const handleAddCategory = (e) => {
    e.preventDefault();
    const val = newCategory.trim();
    if (val && !categories.includes(val)) {
      setCategories([...categories, val]);
      setNewCategory("");
    }
  };

  // Delete a custom category
  const handleDeleteCategory = (indexToDelete) => {
    const catName = categories[indexToDelete];
    setCategories(categories.filter((_, i) => i !== indexToDelete));
    const updatedBudgets = { ...budgets };
    delete updatedBudgets[catName];
    setBudgets(updatedBudgets);
  };

  // Set budget limit for category
  const handleBudgetChange = (catName, val) => {
    setBudgets({
      ...budgets,
      [catName]: val === "" ? "" : parseFloat(val) || 0,
    });
  };

  // Date filtering logic for Dashboard
  const getFilteredTransactions = (items, period) => {
    if (period === "all") return items;

    const tzoffset = new Date().getTimezoneOffset() * 60000;
    const localDate = new Date(Date.now() - tzoffset);
    const todayStr = localDate.toISOString().split("T")[0];

    const nowMs = localDate.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (!item.date) return false;
      if (period === "today") return item.date === todayStr;

      const itemDate = new Date(item.date);
      if (period === "week") {
        const diffMs = nowMs - itemDate.getTime();
        return diffMs >= 0 && diffMs < 7 * oneDayMs;
      }
      if (period === "month") {
        return (
          itemDate.getFullYear() === localDate.getFullYear() &&
          itemDate.getMonth() === localDate.getMonth()
        );
      }
      return true;
    });
  };

  // Compute total expenses for current calendar month by category
  const getCurrentMonthExpenseForCategory = (catName) => {
    const tzoffset = new Date().getTimezoneOffset() * 60000;
    const localDate = new Date(Date.now() - tzoffset);
    const currentYear = localDate.getFullYear();
    const currentMonth = localDate.getMonth();

    return transactions
      .filter((t) => {
        if (t.type !== "Expense" || t.category !== catName || !t.date)
          return false;
        const tDate = new Date(t.date);
        return (
          tDate.getFullYear() === currentYear &&
          tDate.getMonth() === currentMonth
        );
      })
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
  };

  // Renders a visual status badge for a category's budget limit
  const renderBudgetBadge = (catName) => {
    const limit = budgets[catName];
    if (
      limit === undefined ||
      limit === null ||
      limit === "" ||
      parseFloat(limit) <= 0
    ) {
      return null;
    }
    const currentExpense = getCurrentMonthExpenseForCategory(catName);
    const limitVal = parseFloat(limit);
    const ratio = currentExpense / limitVal;

    const badgeStyle = {
      fontSize: "11px",
      padding: "2px 8px",
      width: "auto",
      height: "auto",
      display: "inline-block",
      fontWeight: "600",
      borderRadius: "8px",
    };

    if (ratio > 1.0) {
      return (
        <span className="badge badge-pink" style={badgeStyle}>
          🔴 Exceeded
        </span>
      );
    } else if (ratio >= 0.8) {
      return (
        <span
          className="badge"
          style={{
            ...badgeStyle,
            backgroundColor: "#fef3c7",
            color: "#d97706",
          }}
        >
          🟡 Warning
        </span>
      );
    } else {
      return (
        <span className="badge badge-green" style={badgeStyle}>
          🟢 On Track
        </span>
      );
    }
  };

  // Computed dashboard calculations
  const dashboardFilteredTransactions = getFilteredTransactions(
    transactions,
    timeframe,
  );

  const totalIncome = dashboardFilteredTransactions
    .filter((t) => t.type === "Income")
    .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

  const totalExpense = dashboardFilteredTransactions
    .filter((t) => t.type === "Expense")
    .reduce((acc, t) => acc + parseFloat(t.amount || 0), 0);

  const netBalance = totalIncome - totalExpense;

  const recentEntries = dashboardFilteredTransactions.slice(0, 5);

  const entriesFilteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesType = filterType === "All" || t.type === filterType;
    const matchesCategory =
      filterCategory === "All" || t.category === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  const expenseTransactions = transactions.filter((t) => t.type === "Expense");
  const totalReportExpense = expenseTransactions.reduce(
    (acc, t) => acc + parseFloat(t.amount || 0),
    0,
  );

  const expenseByCategory = {};
  expenseTransactions.forEach((t) => {
    expenseByCategory[t.category] =
      (expenseByCategory[t.category] || 0) + parseFloat(t.amount || 0);
  });

  const userInitial =
    currentUser ?
      (currentUser.businessName || currentUser.name || "M")
        .charAt(0)
        .toUpperCase()
    : "M";

  return (
    <div className="page-wrapper">
      {/* ===== SITE HEADER ===== */}
      <header className="site-header">
        <div className="header-brand">
          <div className="header-logo">₦</div>
          <div>
            <div className="header-title">NairaTrack</div>
            <div className="header-tagline">SME Expense Tracker</div>
          </div>
        </div>

        <nav className="header-nav">
          {currentUser && (
            <span className="header-user-badge">
              🏪 {currentUser.businessName}
            </span>
          )}

          <button
            className={`header-nav-btn ${activeTab !== "about" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            App
          </button>
          <button
            className={`header-nav-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            About Us
          </button>
        </nav>
      </header>

      {/* ===== ABOUT US PAGE ===== */}
      {activeTab === "about" ?
        <main className="main-content">
          <section className="about-section">
            <div className="card about-hero">
              <div className="about-hero-icon">₦</div>
              <h2>About NairaTrack</h2>
              <p>
                NairaTrack is a secure, multi-user expense tracking platform
                designed specifically for Nigerian Small and Medium-sized
                Enterprises (SMEs). We empower business owners with
                password-protected accounts, isolated data, cash flow tracking,
                custom budgets, and instant analytics.
              </p>
            </div>

            <div className="about-features">
              <div className="card about-feature-card">
                <div className="feature-icon">🔒</div>
                <h4>Secure Multi-User Auth</h4>
                <p>
                  Passwords hashed securely with bcrypt. Each business owner
                  gets their own isolated private account.
                </p>
              </div>
              <div className="card about-feature-card">
                <div className="feature-icon">📊</div>
                <h4>Real-Time Dashboard</h4>
                <p>
                  Monitor your revenue, expenses, and net balance with flexible
                  timeframe filters.
                </p>
              </div>
              <div className="card about-feature-card">
                <div className="feature-icon">📁</div>
                <h4>Personalized Categories</h4>
                <p>
                  Define your own operational categories and set monthly
                  spending caps with warning alerts.
                </p>
              </div>
              <div className="card about-feature-card">
                <div className="feature-icon">📋</div>
                <h4>Searchable Ledger</h4>
                <p>
                  Find, filter, and audit past transactions by description,
                  type, and category anytime.
                </p>
              </div>
            </div>
              </section>
        </main>
      : !token ?
        /* ===== UNAUTHENTICATED LOGIN / REGISTER VIEW ===== */
        <div className="auth-wrapper">
          <div className="auth-card">
            <div className="auth-header">
              <div className="auth-logo">₦</div>
              <h2>Welcome to NairaTrack</h2>
              <p>Take full control of your business cash flow</p>
            </div>

            <div className="auth-tabs">
              <button
                className={`auth-tab-btn ${authMode === "login" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("login");
                  setAuthError("");
                }}
              >
                Sign In
              </button>
              <button
                className={`auth-tab-btn ${authMode === "register" ? "active" : ""}`}
                onClick={() => {
                  setAuthMode("register");
                  setAuthError("");
                }}
              >
                Create Account
              </button>
            </div>

            {authError && <div className="auth-error">⚠️ {authError}</div>}

            {authMode === "login" ?
              <form onSubmit={handleLogin}>
                <div className="form-group">
                  <label htmlFor="login-email">Email Address</label>
                  <input
                    type="email"
                    id="login-email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. owner@mybusiness.com"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-password">Password</label>
                  <input
                    type="password"
                    id="login-password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary full-width"
                  disabled={authLoading}
                >
                  {authLoading ? "Signing In..." : "Sign In"}
                </button>
              </form>
            : <form onSubmit={handleRegister}>
                <div className="form-group">
                  <label htmlFor="reg-name">Your Full Name</label>
                  <input
                    type="text"
                    id="reg-name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="e.g. Chukwuma Adebayo"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-biz">Business / Store Name</label>
                  <input
                    type="text"
                    id="reg-biz"
                    value={authBusinessName}
                    onChange={(e) => setAuthBusinessName(e.target.value)}
                    placeholder="e.g. Adebayo Supermarket"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-email">Email Address</label>
                  <input
                    type="email"
                    id="reg-email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="e.g. owner@adebayostores.ng"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="reg-password">
                    Create Password (min. 6 chars)
                  </label>
                  <input
                    type="password"
                    id="reg-password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    minLength={6}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary full-width"
                  disabled={authLoading}
                >
                  {authLoading ?
                    "Creating Account..."
                  : "Register Business Account"}
                </button>
              </form>
            }
          </div>
        </div>
      : /* ===== AUTHENTICATED APP BODY ===== */
        <div className="app-body">
          {/* Sidebar Navigation */}
          <aside className="sidebar">
            <div className="sidebar-top">
              <div className="brand">
                <div className="brand-icon">₦</div>
                <div>
                  <h2 className="brand-title">NairaTrack</h2>
                  <span className="brand-subtitle">SME Expense Tracker</span>
                </div>
              </div>

              <nav className="nav-menu">
                <button
                  onClick={() => setActiveTab("dashboard")}
                  className={`nav-btn ${activeTab === "dashboard" ? "active" : ""}`}
                >
                  <span className="icon">🏠</span> Dashboard
                </button>
                <button
                  onClick={() => setActiveTab("entries")}
                  className={`nav-btn ${activeTab === "entries" ? "active" : ""}`}
                >
                  <span className="icon">📋</span> Entries
                </button>
                <button
                  onClick={() => setActiveTab("categories")}
                  className={`nav-btn ${activeTab === "categories" ? "active" : ""}`}
                >
                  <span className="icon">📁</span> Categories
                </button>
                <button
                  onClick={() => setActiveTab("reports")}
                  className={`nav-btn ${activeTab === "reports" ? "active" : ""}`}
                >
                  <span className="icon">📊</span> Reports
                </button>
              </nav>
            </div>

            {/* Authenticated User Profile Box */}
            <div className="user-profile-box">
              <div className="user-profile">
                <div className="avatar">{userInitial}</div>
                <div>
                  <p className="user-name">
                    {currentUser ? currentUser.businessName : "My Business"}
                  </p>
                  <p className="user-role">
                    {currentUser ? currentUser.name : "SME Owner"}
                  </p>
                </div>
              </div>
              <button onClick={handleLogout} className="btn-logout">
                🚪 Log Out
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="main-content">
            {/* DASHBOARD VIEW */}
            {activeTab === "dashboard" && (
              <section className="view-section">
                <header className="page-header">
                  <div>
                    <h1>Dashboard</h1>
                    <p className="subtitle">
                      Welcome back, {currentUser?.name}. Financial overview for{" "}
                      <strong>{currentUser?.businessName}</strong>.
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "13px",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">This Week</option>
                      <option value="month">This Month</option>
                    </select>
                    <button onClick={openModal} className="btn-primary">
                      + Add Entry
                    </button>
                  </div>
                </header>

                {/* Stat Cards Grid */}
                <div className="stats-grid">
                  <div className="card stat-card">
                    <div className="stat-header">
                      <div className="badge badge-green">↑</div>
                      <span className="stat-type">INCOME</span>
                    </div>
                    <span className="stat-label">Total Income</span>
                    <div className="stat-amount">
                      ₦{totalIncome.toLocaleString()}
                    </div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-header">
                      <div className="badge badge-pink">↓</div>
                      <span className="stat-type">EXPENSES</span>
                    </div>
                    <span className="stat-label">Total Expenses</span>
                    <div className="stat-amount">
                      ₦{totalExpense.toLocaleString()}
                    </div>
                  </div>
                  <div className="card stat-card">
                    <div className="stat-header">
                      <div className="badge badge-blue">₦</div>
                      <span className="stat-type">BALANCE</span>
                    </div>
                    <span className="stat-label">Current Balance</span>
                    <div className="stat-amount">
                      ₦{netBalance.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Recent Entries Card */}
                <div className="card main-card">
                  <div className="card-header">
                    <div>
                      <h3>Recent Entries</h3>
                      <p className="subtitle">
                        Your latest income and expenses.
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("entries")}
                      className="btn-link"
                    >
                      View All
                    </button>
                  </div>

                  {recentEntries.length === 0 ?
                    <div className="empty-state">
                      <div className="empty-icon">₦</div>
                      <h3>No entries yet</h3>
                      <p>Start recording your business transactions.</p>
                      <button
                        onClick={openModal}
                        className="btn-primary"
                        style={{ marginTop: "12px" }}
                      >
                        Add Entry
                      </button>
                    </div>
                  : <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Category</th>
                          <th>Type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentEntries.map((e) => (
                          <tr key={e._id}>
                            <td>{e.date}</td>
                            <td>
                              <strong>{e.title}</strong>
                            </td>
                            <td>{e.category}</td>
                            <td
                              className={
                                e.type === "Income" ?
                                  "tag-income"
                                : "tag-expense"
                              }
                            >
                              {e.type}
                            </td>
                            <td>
                              ₦{parseFloat(e.amount || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                </div>
              </section>
            )}

            {/* ENTRIES VIEW */}
            {activeTab === "entries" && (
              <section className="view-section">
                <header className="page-header">
                  <div>
                    <h1>Entries</h1>
                    <p className="subtitle">
                      Detailed transaction ledger for{" "}
                      {currentUser?.businessName} ({transactions.length} total).
                    </p>
                  </div>
                  <button onClick={openModal} className="btn-primary">
                    + Add Entry
                  </button>
                </header>

                <div className="card main-card">
                  {/* Search & Filter Controls */}
                  <div
                    style={{
                      display: "flex",
                      gap: "12px",
                      marginBottom: "16px",
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      type="text"
                      placeholder="🔍 Search description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        flex: 2,
                        minWidth: "200px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        outline: "none",
                        fontSize: "14px",
                      }}
                    />
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "120px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="All">All Types</option>
                      <option value="Income">Income</option>
                      <option value="Expense">Expense</option>
                    </select>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "150px",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        outline: "none",
                        cursor: "pointer",
                      }}
                    >
                      <option value="All">All Categories</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {entriesFilteredTransactions.length === 0 ?
                    <div className="empty-state">
                      <div className="empty-icon">₦</div>
                      <h3>No matches found</h3>
                      <p>Try refining your search or filters.</p>
                    </div>
                  : <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Category</th>
                          <th>Type</th>
                          <th>Amount</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entriesFilteredTransactions.map((e) => (
                          <tr key={e._id}>
                            <td>{e.date}</td>
                            <td>
                              <strong>{e.title}</strong>
                            </td>
                            <td>{e.category}</td>
                            <td
                              className={
                                e.type === "Income" ?
                                  "tag-income"
                                : "tag-expense"
                              }
                            >
                              {e.type}
                            </td>
                            <td>
                              ₦{parseFloat(e.amount || 0).toLocaleString()}
                            </td>
                            <td>
                              <button
                                className="btn-danger"
                                onClick={() => handleDeleteTransaction(e._id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  }
                </div>
              </section>
            )}

            {/* CATEGORIES VIEW */}
            {activeTab === "categories" && (
              <section className="view-section">
                <header className="page-header">
                  <div>
                    <h1>Categories</h1>
                    <p className="subtitle">
                      Manage transaction classification and monthly budget
                      targets for {currentUser?.businessName}.
                    </p>
                  </div>
                </header>

                <div className="card main-card max-w-lg">
                  <form onSubmit={handleAddCategory} className="inline-form">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="New category name..."
                      required
                    />
                    <button type="submit" className="btn-primary">
                      Add
                    </button>
                  </form>
                  <ul className="category-list">
                    {categories.map((c, i) => (
                      <li
                        key={i}
                        style={{
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontWeight: "600" }}>{c}</span>
                          <button
                            className="btn-danger"
                            onClick={() => handleDeleteCategory(i)}
                          >
                            Remove
                          </button>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            marginTop: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              flex: 1,
                            }}
                          >
                            <label
                              style={{
                                fontSize: "11px",
                                color: "#666",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Monthly Budget: ₦
                            </label>
                            <input
                              type="number"
                              placeholder="No limit"
                              value={budgets[c] !== undefined ? budgets[c] : ""}
                              onChange={(e) =>
                                handleBudgetChange(c, e.target.value)
                              }
                              style={{
                                padding: "4px 8px",
                                borderRadius: "6px",
                                border: "1px solid #ddd",
                                fontSize: "12px",
                                width: "100%",
                              }}
                            />
                          </div>
                          <div
                            style={{ minWidth: "100px", textAlign: "right" }}
                          >
                            {renderBudgetBadge(c)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* REPORTS VIEW */}
            {activeTab === "reports" && (
              <section className="view-section">
                <header className="page-header">
                  <div>
                    <h1>Reports</h1>
                    <p className="subtitle">
                      Financial health and category insights for{" "}
                      {currentUser?.businessName}.
                    </p>
                  </div>
                </header>

                <div className="card main-card max-w-lg">
                  <h3>Expenses by Category</h3>
                  <div style={{ marginTop: "16px" }}>
                    {totalReportExpense === 0 ?
                      <p style={{ color: "#888" }}>
                        No expense data available.
                      </p>
                    : Object.entries(expenseByCategory).map(([cat, amt]) => {
                        const pct = ((amt / totalReportExpense) * 100).toFixed(
                          1,
                        );
                        const limit = budgets[cat];
                        const hasLimit =
                          limit !== undefined &&
                          limit !== null &&
                          limit !== "" &&
                          parseFloat(limit) > 0;

                        return (
                          <div
                            className="report-item"
                            key={cat}
                            style={{ marginBottom: "20px" }}
                          >
                            <div className="report-row">
                              <div>
                                <strong style={{ fontSize: "14px" }}>
                                  {cat}
                                </strong>
                                {hasLimit && (
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "#666",
                                      marginLeft: "8px",
                                    }}
                                  >
                                    (Budget: ₦
                                    {parseFloat(limit).toLocaleString()})
                                  </span>
                                )}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                <span>
                                  ₦{amt.toLocaleString()} ({pct}%)
                                </span>
                                {renderBudgetBadge(cat)}
                              </div>
                            </div>
                            <div className="progress-bar">
                              <div
                                className="progress-fill"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      }

      {/* ===== SITE FOOTER ===== */}
      <footer className="site-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3>₦ NairaTrack</h3>
            <p>
              Helping Nigerian SMEs take control of their finances with secure,
              password-protected bookkeeping.
            </p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <ul>
              <li>
                <button onClick={() => setActiveTab("dashboard")}>
                  Dashboard
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab("entries")}>Entries</button>
              </li>
              <li>
                <button onClick={() => setActiveTab("categories")}>
                  Categories
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab("reports")}>Reports</button>
              </li>
              <li>
                <button onClick={() => setActiveTab("about")}>About Us</button>
              </li>
            </ul>
          </div>
          <div className="footer-links">
            <h4>Security & Privacy</h4>
            <ul>
              <li>
                <button>Bcrypt Encrypted</button>
              </li>
              <li>
                <button>JWT Token Protected</button>
              </li>
              <li>
                <button>Isolated User Data</button>
              </li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} NairaTrack — Built for Nigerian SMEs. All
          rights reserved.
        </div>
      </footer>

      {/* ===== ADD ENTRY MODAL POPUP ===== */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-box">
            <div className="modal-header">
              <h2>Add New Entry</h2>
              <button onClick={closeModal} className="btn-close">
                &times;
              </button>
            </div>

            <form onSubmit={handleAddTransaction}>
              <div className="form-group">
                <label htmlFor="entry-type">Type</label>
                <select
                  id="entry-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="entry-title">Description</label>
                <input
                  type="text"
                  id="entry-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sales Payment or Electricity Bill"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="entry-amount">Amount (₦)</label>
                <input
                  type="number"
                  step="0.01"
                  id="entry-amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="entry-category">Category</label>
                <select
                  id="entry-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="entry-date">Date</label>
                <input
                  type="date"
                  id="entry-date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn-primary full-width">
                Save Entry
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
