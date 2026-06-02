# QueryWiz — Natural Language to SQL Core Dashboard

An elegant, high-fidelity full-stack web application designed for **Jadai Studios** deployed on **querywiz.jadai.dev**. Transform plain English questions into valid PostgreSQL queries and view actual, live e-commerce metrics in high-contrast tables and charts.

---

## 🎨 Design Systems
- **Palette**: Void Black (`#0a0a0a`), Ancient Gold Accent (`#C9A84C`), Slate grey text (`#e8e8e8`).
- **Typography Pairing**: *Cinzel* for headings, *JetBrains Mono* for SQL code blocks and monospaced widgets, *Inter* for legible form elements.
- **Micro-interactions**: Interactive bar hover states, focus borders with gold glow effects, and staggered animation entries powered by `motion/react`.

---

## 🏗️ Schema Overview (PostgreSQL)

QueryWiz targets an e-commerce database with a 5-table relational schema:
1. `customers` (id, name, email, city, signup_date, is_active)
2. `products` (id, name, category, price, stock_quantity, added_date)
3. `orders` (id, customer_id, order_date, total_amount, status)
4. `order_items` (id, order_id, product_id, quantity, unit_price)
5. `reviews` (id, product_id, customer_id, rating, review_text, created_at)

The application automatically validates generated SQL on the backend to enforce read-only execution constraints (e.g. rejecting `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `CREATE`, comments, and semicolon chaining).

---

## 🏁 Quick Start: Local Setup

### Prerequisite Checklist
- Node.js (v20+)
- Docker & Docker Compose (optional for in-sandbox execution)

### 1. Standalone Docker Compose Installation (Easiest)
Spin up PostgreSQL and the QueryWiz application instantly with a single command:
```bash
# Clone and enter directory, then launch the containers
docker-compose up --build
```
This boots Postgres at `localhost:5432`, compiles the production React build, bundles the Express backend via `esbuild`, and binds the full-stack server on `http://localhost:3000`. The server automatically checks for empty tables, runs `/schema.sql`, and Seeds the database on first launch!

### 2. Manual Development Boot
To run independent of docker:
```bash
# Install NPM packages
npm install

# Build local environment config
cp .env.example .env

# Run development fullstack server (Express API + Vite Dev Server on Port 3000)
npm run dev
```

---

## ☁️ Cloud Service Deployment Guides

### A. Supabase / Railway Setup
To supply your own remote PostgreSQL Database:

1. **Provision DB**: Create a blank project on Supabase or Railway.
2. **Execute Schema**: Copy the contents of `/schema.sql` and run them in your SQL Editor console.
3. **Seed Database**: run the faker script against your database to populate **19,700 rows** of mock data:
   ```bash
   DATABASE_URL="your-supabase-connection-string" node seed.js
   ```
4. **Update App Variables**: In your Cloud Run instance or Railway, add `DATABASE_URL` pointing to your database. The application will immediately switch from the local PGlite database to your remote PostgreSQL db server!

### B. Securing the Database with a Read-Only User
Prior to production deploy, we highly recommend executing queries using a restricted read-only user rather than the Postgres admin user. Execute these SQL operations in your PostgreSQL terminal:

```sql
-- 1. Create a read-only role
CREATE ROLE querywiz_readonly WITH LOGIN PASSWORD 'use_a_strong_secured_password_here';

-- 2. Connect to your database and grant connect permissions
GRANT CONNECT ON DATABASE postgres TO querywiz_readonly;

-- 3. Grant usage rights to the public schema
GRANT USAGE ON SCHEMA public TO querywiz_readonly;

-- 4. Grant SELECT-only privileges on tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO querywiz_readonly;

-- 5. Establish default SELECT grants for any tables created in the future
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO querywiz_readonly;
```
Configure your production app container with `DATABASE_URL` using this newly created `querywiz_readonly` user.

### C. Vercel Deployment (Frontend Only)
To host the frontend visual dashboard on Vercel:
1. Make sure to set `VITE_API_URL` to point to your live deployed backend URL (e.g. `https://api.querywiz.jadai.dev`).
2. Set build directory output to `dist`.

---

## 🔑 Environment Variables Reference

Define these parameters inside your `.env` config file:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (Supabase/Railway). If omitted, falls back to local embedded Postgres. | *(Optional Fallback)* |
| `GROQ_API_KEY` | Groq API Key required for Llama-3.1 translation. | *(Optional)* |
| `GEMINI_API_KEY` | Google Gemini API Key. Used automatically if Groq key isn't provided. | *(Auto-configured in AI Studio)* |
| `RATE_LIMIT_MAX_PER_WINDOW` | Maximum questions allowed per minute per IP. | `10` |
| `RATE_LIMIT_MAX_PER_DAY` | Maximum queries allowed per day per IP. | `100` |
| `PORT` | Networking port for Express ingress access. | `3000` |
