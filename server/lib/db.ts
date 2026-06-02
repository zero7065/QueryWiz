/**
 * Database client adapter for QueryWiz focusing on the Jadai Studios portfolio schema.
 * Supports external PostgreSQL (via standard 'pg' pool) and falls back to
 * a local in-process PostgreSQL compatible database (via '@electric-sql/pglite').
 * 
 * Includes the "jadai_demo" schema, query logging, live database mode, and administrative seeding controls.
 */
import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Primary connection details
const DATABASE_URL = process.env.DATABASE_URL;
const LIVE_DATABASE_URL = process.env.LIVE_DATABASE_URL;

export interface QueryResult {
  rows: any[];
  rowCount: number;
  columns: string[];
}

let pool: pg.Pool | null = null;
let livePool: pg.Pool | null = null;
let pgliteDb: PGlite | null = null;

/**
 * Initializes the database and active pools.
 */
export async function initDatabase() {
  if (DATABASE_URL) {
    console.log("[QueryWiz DB] Initializing master database pool...");
    pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes("supabase.co") || DATABASE_URL.includes("railway.app") 
        ? { rejectUnauthorized: false } 
        : undefined,
    });
  } else {
    console.log("[QueryWiz DB] Using local embedded PostgreSQL (PGlite).");
    const dbPath = path.resolve(process.cwd(), "./.data/pglite_data");
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    pgliteDb = new PGlite(dbPath);
    await pgliteDb.waitReady;
  }

  // Live database configuration
  if (LIVE_DATABASE_URL) {
    console.log("[QueryWiz DB] Live database URL discovered. Priming Live connections...");
    try {
      livePool = new pg.Pool({
        connectionString: LIVE_DATABASE_URL,
        ssl: LIVE_DATABASE_URL.includes("supabase.co") || LIVE_DATABASE_URL.includes("railway.app")
          ? { rejectUnauthorized: false }
          : undefined,
      });
    } catch (e) {
      console.error("[QueryWiz DB] Failed to create Live database pool:", e);
    }
  } else {
    console.log("[QueryWiz DB] No LIVE_DATABASE_URL provided. Live Mode is locked.");
  }

  // Build schema and populate mock Jadai database
  await ensureSchemaAndSeed(false);
}

/**
 * Helper to check if live mode is physically configured
 */
export function isLiveModeConfigured(): boolean {
  return !!LIVE_DATABASE_URL;
}

/**
 * Log queries on the backend for analysis
 */
export async function logQuery(question: string, sql: string, rowCount: number, executionMs: number, ip: string, error: string | null) {
  const ipHash = crypto.createHash("sha256").update(ip || "anonymous").digest("hex");
  const insertQuery = `
    INSERT INTO query_logs (question, generated_sql, row_count, execution_ms, ip_hash, error, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW());
  `;
  try {
    if (pool) {
      await pool.query(insertQuery, [question, sql, rowCount, executionMs, ipHash, error]);
    } else if (pgliteDb) {
      await pgliteDb.query(insertQuery, [question, sql, rowCount, executionMs, ipHash, error]);
    }
  } catch (err) {
    console.error("[QueryWiz DB] Failed to store query log:", err);
  }
}

/**
 * Executes queries in either Demo mode (using the custom schema search_path) or Live mode.
 */
export async function executeQuery(sql: string, params: any[] = [], isLive = false): Promise<QueryResult> {
  if (isLive) {
    if (!livePool) {
      throw new Error("Live database connection has not been configured in secrets.");
    }
    const res = await livePool.query({ text: sql, values: params });
    const columns = res.fields ? res.fields.map(f => f.name) : (res.rows[0] ? Object.keys(res.rows[0]) : []);
    return {
      rows: res.rows || [],
      rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0),
      columns,
    };
  } else {
    const searchPathQuery = "SET search_path TO jadai_demo, public;";
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query(searchPathQuery);
        const res = await client.query({ text: sql, values: params });
        const columns = res.fields ? res.fields.map(f => f.name) : (res.rows[0] ? Object.keys(res.rows[0]) : []);
        return {
          rows: res.rows || [],
          rowCount: res.rowCount ?? (res.rows ? res.rows.length : 0),
          columns,
        };
      } finally {
        client.release();
      }
    } else if (pgliteDb) {
      await pgliteDb.query(searchPathQuery);
      const res = await pgliteDb.query(sql, params);
      const columns = res.fields ? res.fields.map(f => f.name) : (res.rows[0] ? Object.keys(res.rows[0]) : []);
      return {
        rows: res.rows || [],
        rowCount: res.rows ? res.rows.length : 0,
        columns,
      };
    } else {
      throw new Error("Database client not initialized.");
    }
  }
}

/**
 * Ensures schemas exist and the DB is seeded.
 */
export async function ensureSchemaAndSeed(forceReset = false) {
  let schemaExists = false;
  
  if (!forceReset) {
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'jadai_demo' 
        AND table_name = 'projects'
      );
    `;
    try {
      if (pool) {
        const res = await pool.query(checkTableQuery);
        schemaExists = res.rows[0]?.exists === true;
      } else if (pgliteDb) {
        const res = await pgliteDb.query<{ exists: boolean }>(checkTableQuery);
        schemaExists = res.rows[0]?.exists === true;
      }
    } catch (err) {
      console.warn("[QueryWiz DB] Table check error, attempting recreate:", err);
    }
  }

  if (!schemaExists || forceReset) {
    console.log("[QueryWiz DB] Setting up `jadai_demo` schema and inserting real portfolio data...");
    await createSchema();
    await seedDemoData();
  } else {
    console.log("[QueryWiz DB] `jadai_demo` schema resides in active memory. System is primed.");
  }
}

async function createSchema() {
  const schemaSQL = `
    CREATE SCHEMA IF NOT EXISTS jadai_demo;
    SET search_path TO jadai_demo, public;

    DROP TABLE IF EXISTS deployments CASCADE;
    DROP TABLE IF EXISTS subscriptions CASCADE;
    DROP TABLE IF EXISTS platform_events CASCADE;
    DROP TABLE IF EXISTS tech_skills CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
    DROP TABLE IF EXISTS query_logs CASCADE;
    DROP TABLE IF EXISTS admin_config CASCADE;

    CREATE TABLE projects (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE,
      category VARCHAR(50),
      status VARCHAR(30),
      tech_stack TEXT[],
      launched_date DATE,
      monthly_users INT,
      revenue_ngn DECIMAL(12,2),
      github_stars INT,
      description TEXT
    );

    CREATE TABLE tech_skills (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) UNIQUE,
      category VARCHAR(50),
      proficiency INT CHECK (proficiency BETWEEN 1 AND 10),
      years_used DECIMAL(3,1),
      projects_used_in INT
    );

    CREATE TABLE platform_events (
      id SERIAL PRIMARY KEY,
      project_id INT REFERENCES projects(id) ON DELETE CASCADE,
      event_type VARCHAR(50),
      occurred_at TIMESTAMP,
      user_region VARCHAR(50),
      metadata JSONB
    );

    CREATE TABLE subscriptions (
      id SERIAL PRIMARY KEY,
      project_id INT REFERENCES projects(id) ON DELETE CASCADE,
      plan_name VARCHAR(50),
      amount_ngn DECIMAL(10,2),
      subscribed_at TIMESTAMP,
      is_active BOOLEAN,
      user_region VARCHAR(50)
    );

    CREATE TABLE deployments (
      id SERIAL PRIMARY KEY,
      project_id INT REFERENCES projects(id) ON DELETE CASCADE,
      version VARCHAR(20),
      deploy_date TIMESTAMP,
      platform VARCHAR(50),
      notes TEXT,
      is_stable BOOLEAN
    );

    CREATE TABLE query_logs (
      id SERIAL PRIMARY KEY,
      question TEXT,
      generated_sql TEXT,
      row_count INT,
      execution_ms INT,
      ip_hash VARCHAR(64),
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE admin_config (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT
    );
  `;

  if (pool) {
    await pool.query(schemaSQL);
  } else if (pgliteDb) {
    await pgliteDb.exec(schemaSQL);
  }
}

async function seedDemoData() {
  const { faker } = await import("@faker-js/faker");
  console.log("[QueryWiz DB] Starting portfolio seed generation...");

  const executeBulk = async (queryList: string[]) => {
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET search_path TO jadai_demo, public;");
        for (const sql of queryList) {
          await client.query(sql);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } else if (pgliteDb) {
      await pgliteDb.transaction(async (tx) => {
        await tx.query("SET search_path TO jadai_demo, public;");
        for (const sql of queryList) {
          await tx.query(sql);
        }
      });
    }
  };

  // 1. Projects Seed
  const projectQueries = [
    `INSERT INTO projects (id, name, category, status, tech_stack, launched_date, monthly_users, revenue_ngn, github_stars, description) VALUES (1, 'ExamPadi AI', 'EdTech', 'live', '{"React", "Node.js", "Firebase", "Gemini"}', '2024-03-15', 12000, 450000.00, 25, 'Comprehensive exam preparation app featuring AI tutors and mock test analyzers');`,
    `INSERT INTO projects (id, name, category, status, tech_stack, launched_date, monthly_users, revenue_ngn, github_stars, description) VALUES (2, 'ATHENA', 'AI Tool', 'live', '{"React", "FastAPI", "PostgreSQL", "Groq"}', '2024-08-10', 4500, 180000.00, 42, 'Autonomous corporate document analyzer and deep research intelligence analyst with natural retrieval');`,
    `INSERT INTO projects (id, name, category, status, tech_stack, launched_date, monthly_users, revenue_ngn, github_stars, description) VALUES (3, 'QueryWiz', 'AI Tool', 'live', '{"React", "Vite", "Express", "PGlite", "Gemini"}', '2025-01-20', 2400, 65000.00, 18, 'Interactive natural language interface converting user questions to analytical queries on any client db');`,
    `INSERT INTO projects (id, name, category, status, tech_stack, launched_date, monthly_users, revenue_ngn, github_stars, description) VALUES (4, 'Stylez', 'SaaS', 'in_development', '{"React Native", "Node.js", "Supabase"}', '2025-05-01', 800, 0.00, 5, 'On-demand beauty and salon booking catalog showcasing high-quality local grooming providers');`,
    `INSERT INTO projects (id, name, category, status, tech_stack, launched_date, monthly_users, revenue_ngn, github_stars, description) VALUES (5, 'jadai.dev', 'Portfolio', 'live', '{"Next.js", "Tailwind CSS", "Vercel"}', '2023-06-01', 3500, 0.00, 30, 'Professional portfolio showcase demonstrating open-source innovations, stats, and real-time app playpens');`
  ];
  await executeBulk(projectQueries);
  console.log("[QueryWiz DB] Seeded Jadai projects.");

  // 2. Tech Skills Seed
  const skillQueries = [
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('React', 'Frontend', 9, 4.5, 5);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('TypeScript', 'Frontend', 9, 3.5, 5);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Node.js', 'Backend', 8, 4.0, 4);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Express', 'Backend', 8, 3.5, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Python', 'Backend', 7, 3.0, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('FastAPI', 'Backend', 8, 2.0, 1);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('PostgreSQL', 'Database', 8, 3.0, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Firebase', 'Database', 8, 4.0, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Groq API', 'AI', 9, 1.5, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Gemini API', 'AI', 9, 1.5, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Supabase', 'Database', 8, 2.0, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Docker', 'Backend', 7, 2.5, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Tailwind CSS', 'Frontend', 9, 4.0, 5);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Next.js', 'Frontend', 8, 2.5, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Vercel', 'Backend', 8, 3.0, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Railway', 'Backend', 8, 2.5, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('PGlite', 'Database', 7, 1.0, 1);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Framer Motion', 'Frontend', 8, 2.0, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('REST APIs', 'Backend', 9, 4.5, 5);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('GraphQL', 'Backend', 7, 2.0, 1);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('OAuth 2.0', 'Backend', 8, 2.5, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Jest', 'Backend', 7, 2.5, 3);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Redux Toolkit', 'Frontend', 8, 3.0, 2);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Linux', 'Backend', 7, 3.5, 4);`,
    `INSERT INTO tech_skills (name, category, proficiency, years_used, projects_used_in) VALUES ('Github Actions', 'Backend', 7, 2.0, 3);`
  ];
  await executeBulk(skillQueries);
  console.log("[QueryWiz DB] Seeded tech skills.");

  // 3. Platform Events (3,000 spread realistically)
  // March-April and October-November are JAMB/School season spikes for ExamPadi (ID 1)
  const regions = ["Lagos", "Abuja", "Jos", "Kano", "Port Harcourt"];
  const eventTypesByProject: { [projId: number]: string[] } = {
    1: ["signup", "subscription", "query", "exam_attempt", "login"],
    2: ["query", "login", "subscription", "document_upload"],
    3: ["query", "login", "sql_export"],
    4: ["barber_view", "appointment_book", "login"],
    5: ["view_portfolio", "click_link"]
  };

  const getEventDate = (): Date => {
    const year = faker.helpers.arrayElement([2024, 2025]);
    // Weight index of months: 0 = Jan, 1 = Feb, etc.
    const monthIndex = faker.helpers.weightedArrayElement([
      { value: 0, weight: 6 },  // Jan
      { value: 1, weight: 6 },  // Feb
      { value: 2, weight: 24 }, // Mar (JAMB spike!)
      { value: 3, weight: 26 }, // Apr (JAMB spike!)
      { value: 4, weight: 7 },  // May
      { value: 5, weight: 5 },  // Jun
      { value: 6, weight: 5 },  // Jul
      { value: 7, weight: 6 },  // Aug
      { value: 8, weight: 8 },  // Sep
      { value: 9, weight: 20 }, // Oct (Autumn Exam spike!)
      { value: 10, weight: 22 },// Nov (Autumn Exam spike!)
      { value: 11, weight: 10 } // Dec
    ]);
    const day = faker.number.int({ min: 1, max: 28 });
    const hour = faker.number.int({ min: 0, max: 23 });
    const min = faker.number.int({ min: 0, max: 59 });
    return new Date(year, monthIndex, day, hour, min, 0);
  };

  const platformEvents: string[] = [];
  for (let i = 0; i < 3000; i++) {
    const projectId = faker.helpers.weightedArrayElement([
      { value: 1, weight: 50 }, // ExamPadi major traffic
      { value: 2, weight: 18 }, // Athena moderate corporate
      { value: 3, weight: 12 }, // QueryWiz
      { value: 4, weight: 6 },  // Stylez
      { value: 5, weight: 14 }  // Portfolio
    ]);

    const eventTypes = eventTypesByProject[projectId];
    const eventType = faker.helpers.arrayElement(eventTypes);
    const dateStr = getEventDate().toISOString().replace("T", " ").substring(0, 19);
    const region = faker.helpers.arrayElement(regions);
    
    let meta = "{}";
    if (eventType === "exam_attempt") {
      meta = JSON.stringify({ score: faker.number.int({ min: 180, max: 340 }), subject: faker.helpers.arrayElement(["English", "Mathematics", "Physics", "Chemistry", "Biology"]) });
    } else if (eventType === "query" || eventType === "sql_export") {
      meta = JSON.stringify({ execution_time_ms: faker.number.int({ min: 5, max: 250 }) });
    } else if (eventType === "appointment_book") {
      meta = JSON.stringify({ tier: faker.helpers.arrayElement(["Premium Cut", "Standard Styling", "Manicure"]) });
    }

    platformEvents.push(
      `INSERT INTO platform_events (project_id, event_type, occurred_at, user_region, metadata) VALUES (${projectId}, '${eventType}', '${dateStr}', '${region}', '${meta.replace(/'/g, "''")}');`
    );
  }

  // Seeding events in chunks
  const CHUNK_SIZE = 500;
  for (let i = 0; i < platformEvents.length; i += CHUNK_SIZE) {
    await executeBulk(platformEvents.slice(i, i + CHUNK_SIZE));
  }
  console.log(`[QueryWiz DB] Seeded ${platformEvents.length} platform events.`);

  // 4. Subscriptions Seed (200 records)
  // ExamPadi tiers: Monthly (₦3,000), Quarterly (₦7,500), Annual (₦24,000)
  // Athena: Enterprise Tier (₦150,000 / month)
  const subscriptions: string[] = [];
  for (let i = 0; i < 200; i++) {
    const projId = faker.helpers.weightedArrayElement([
      { value: 1, weight: 75 }, // ExamPadi AI gets heavy subscriptions
      { value: 2, weight: 20 }, // ATHENA
      { value: 3, weight: 5 }   // QueryWiz
    ]);

    let planName = "";
    let amountStr = "0.00";
    
    if (projId === 1) {
      planName = faker.helpers.weightedArrayElement([
        { value: "Monthly", weight: 60 },
        { value: "Quarterly", weight: 30 },
        { value: "Annual", weight: 10 }
      ]);
      amountStr = planName === "Monthly" ? "3000.00" : planName === "Quarterly" ? "7500.00" : "24000.00";
    } else if (projId === 2) {
      planName = faker.helpers.arrayElement(["Corporate Light", "Corporate Full"]);
      amountStr = planName === "Corporate Light" ? "80000.00" : "150000.00";
    } else {
      planName = "AI Pro Access";
      amountStr = "12000.00";
    }

    const dateStr = getEventDate().toISOString().replace("T", " ").substring(0, 19);
    const active = faker.datatype.boolean({ probability: 0.82 });
    const region = faker.helpers.arrayElement(regions);

    subscriptions.push(
      `INSERT INTO subscriptions (project_id, plan_name, amount_ngn, subscribed_at, is_active, user_region) VALUES (${projId}, '${planName}', ${amountStr}, '${dateStr}', ${active}, '${region}');`
    );
  }
  await executeBulk(subscriptions);
  console.log(`[QueryWiz DB] Seeded ${subscriptions.length} subscription orders.`);

  // 5. Deployments (15 across target products)
  const deploymentQueries = [
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (1, '1.0.0', '2024-03-10 14:00:00', 'Vercel', 'Initial stable ExamPadi AI boot', true);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (1, '1.4.2', '2024-10-02 11:30:00', 'Vercel', 'Added JAMB test simulator and progress dashboards', true);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (1, '2.0.0-rc1', '2025-05-18 09:12:00', 'Vercel', 'Gemini live speech translation and audio tutor update', false);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (2, '1.0.0', '2024-08-04 18:22:00', 'Railway', 'Athena core PDF indexing engine up', true);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (2, '1.1.0', '2024-12-15 01:05:00', 'Railway', 'Connected vector-similarity embedding cache', true);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (3, '1.0.0', '2025-01-18 10:00:00', 'Railway', 'Official release of QueryWiz UI standalone client', true);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (3, '1.0.4', '2025-06-01 16:45:00', 'Railway', 'Integrated full dual-mode support, auto-insights engine and historical side-panels', true);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (4, '0.1.0-alpha', '2025-04-28 20:00:00', 'Supabase', 'Bootstrapping styling layouts and static barber databases', false);`,
    `INSERT INTO deployments (project_id, version, deploy_date, platform, notes, is_stable) VALUES (5, '1.0.0', '2023-05-28 08:00:00', 'Vercel', 'Initial release of developer card portfolio', true);`
  ];
  await executeBulk(deploymentQueries);
  console.log("[QueryWiz DB] Seeded operational deployments.");

  // Presets inside admin_config
  const defaults = [
    `INSERT INTO admin_config (key, value) VALUES ('auto_insights_enabled', 'true');`,
    `INSERT INTO admin_config (key, value) VALUES ('follow_ups_enabled', 'true');`,
    `INSERT INTO admin_config (key, value) VALUES ('exposed_live_tables', '["projects", "tech_skills", "query_logs"]');`
  ];
  await executeBulk(defaults);
  console.log("[QueryWiz DB] Configured admin table guidelines.");

  console.log("[QueryWiz DB] Seed Complete. Jadai database tells the stories perfectly.");
}
