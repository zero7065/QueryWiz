/**
 * AI client logic for translating natural language questions into SQL, repairing SQL errors,
 * generating analysis insights, follow-up recommendations, and explaining SQL statements.
 * Integrates Groq and falls back to Google Gemini 3.5 Flash inside AI Studio.
 */
import { Groq } from "groq-sdk";
import { GoogleGenAI } from "@google/genai";

let groqClient: Groq | null = null;
let geminiClient: GoogleGenAI | null = null;

export function getGroqClient(): Groq | null {
  if (!groqClient && process.env.GROQ_API_KEY) {
    try {
      groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
      console.log("[QueryWiz AI] Groq client initialized successfully.");
    } catch (e) {
      console.error("[QueryWiz AI] Failed to initialize Groq client:", e);
    }
  }
  return groqClient;
}

export function getGeminiClient(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });
      console.log("[QueryWiz AI] Gemini client initialized successfully.");
    } catch (e) {
      console.error("[QueryWiz AI] Failed to initialize Gemini client:", e);
    }
  }
  return geminiClient;
}

const DEMO_SCHEMA_PROMPT = `You are a PostgreSQL expert. The user is querying the Jadai Studios portfolio database in schema \"jadai_demo\".

Tables:
- projects (id, name, category, status, tech_stack, launched_date, monthly_users, revenue_ngn, github_stars, description)
  * Categories: 'EdTech', 'AI Tool', 'Portfolio', 'SaaS'
  * Status: 'live', 'in_development', 'archived'
  * Tech stack contains standard text array elements: e.g., '{"React", "Node.js", "Firebase", "Gemini"}'
  * Name values: 'ExamPadi AI', 'ATHENA', 'QueryWiz', 'Stylez', 'jadai.dev'
- tech_skills (id, name, category, proficiency, years_used, projects_used_in)
  * Categories: 'Frontend', 'Backend', 'AI', 'Database', 'Web3'
  * Proficiency: 1-10 (e.g. 9 for expert)
- platform_events (id, project_id, event_type, occurred_at, user_region, metadata)
  * Event Types: 'signup', 'subscription', 'query', 'login', 'exam_attempt', 'view_portfolio', 'click_link'
  * User region: 'Lagos', 'Abuja', 'Jos', 'Kano', 'Port Harcourt'
  * Metadata contains JSONB: e.g. score, subject, execution_time_ms
- subscriptions (id, project_id, plan_name, amount_ngn, subscribed_at, is_active, user_region)
  * Plan name: 'Monthly', 'Quarterly', 'Annual', 'Corporate Light', 'Corporate Full', 'AI Pro Access'
  * Amount_ngn: Monthly is 3000.00, Quarterly is 7500.00, Annual is 24000.00, etc.
- deployments (id, project_id, version, deploy_date, platform, notes, is_stable)
  * Platform: 'Vercel', 'Railway', 'Supabase'

Rules:
- Return ONLY a valid PostgreSQL SELECT query
- No markdown, no backticks, no markdown fence block, no explanation, no semicolon
- Never use DROP, DELETE, UPDATE, INSERT, ALTER, CREATE, TRUNCATE, GRANT, or REVOKE
- Limit results to 100 rows max unless user specifies otherwise
- If you need to search array columns like tech_stack, you can use: 'React' = ANY(tech_stack) or array_to_string(tech_stack, ',') LIKE '%React%'
- Always use explicit table aliases for clarity (e.g. "p.name")
- If the question cannot be answered, return: SELECT 'Cannot answer this question with available data' as message`;

/**
 * Strips formatting artifacts like markdown backticks, SQL prefixes, and ending semicolons.
 */
export function cleanSQLResponse(rawSql: string): string {
  let cleaned = rawSql.trim();
  
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(sql)?/i, "").replace(/```$/, "").trim();
  }
  
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.substring(1, cleaned.length - 1).trim();
  }

  while (cleaned.endsWith(";")) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  return cleaned;
}

/**
 * Utility to execute completions on either Groq or Gemini with 10s timeout constraints
 */
async function getCompletion(prompt: string, systemPrompt: string, temperature = 0.1): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI took too long — please try again")), 10000)
  );

  const requestPromise = (async () => {
    const groq = getGroqClient();
    if (groq) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        temperature,
      });
      return completion.choices[0]?.message?.content || "";
    }

    const gemini = getGeminiClient();
    if (gemini) {
      const response = await gemini.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: systemPrompt,
          temperature,
        }
      });
      return response.text || "";
    }

    throw new Error("AI provider configuration is missing (GROQ_API_KEY or GEMINI_API_KEY required).");
  })();

  return Promise.race([requestPromise, timeoutPromise]);
}

/**
 * Translates English questions into PostgreSQL SQL.
 */
export async function translateQuestionToSQL(question: string, isLive = false, liveSchemaPrompt?: string): Promise<string> {
  const processedQuestion = question.trim();
  if (!processedQuestion) {
    throw new Error("Question cannot be empty.");
  }

  const systemPrompt = isLive && liveSchemaPrompt ? liveSchemaPrompt : DEMO_SCHEMA_PROMPT;
  const rawSql = await getCompletion(processedQuestion, systemPrompt);
  return cleanSQLResponse(rawSql);
}

/**
 * Attempts to repair query that failed during DB execution. Handled automatically once.
 */
export async function repairSQL(question: string, failedSql: string, errorMsg: string, isLive = false, liveSchemaPrompt?: string): Promise<string> {
  const systemPrompt = isLive && liveSchemaPrompt ? liveSchemaPrompt : DEMO_SCHEMA_PROMPT;
  const prompt = `
Original user question: "${question}"
The SQL query that failed:
\`\`\`sql
${failedSql}
\`\`\`
The database execution returned this error message:
"${errorMsg}"

Please analyze why this query failed (e.g. incorrect table columns, bad syntax, incorrect function parameters) and output a corrected PostgreSQL SELECT query that perfectly answers the user's question. 
Output ONLY the clean, raw SQL text. Do NOT include markdown blocks, backticks, comments, explanation, or semicolons.`;

  const rawSql = await getCompletion(prompt, systemPrompt);
  return cleanSQLResponse(rawSql);
}

/**
 * Step by step teaching query explainer for developer juniors
 */
export async function explainSQL(sql: string): Promise<string> {
  const systemPrompt = `You are a patient database systems teacher. 
Explain this SQL query in plain English, step by step, like teaching a junior developer. 
Focus on what tables are joined, how rows are filtered, aggregated, and what columns are being selected.
Max 150 words. Be clean, friendly, and structured.`;

  return getCompletion(sql, systemPrompt, 0.4);
}

/**
 * Surprising quick insights generator based on results rows
 */
export async function generateInsights(sql: string, rows: any[]): Promise<string> {
  const subset = rows.slice(0, 10);
  const prompt = `
SQL Played:
${sql}

Result Rows (Up to first 10):
${JSON.stringify(subset, null, 2)}

Analyze this SQL query and the actual returned rows to surface 1-2 surprising insights and key business findings in plain English. 
Write maximum 2 sentences. Be specific about the numbers or entities discovered in the data. Be highly professional and objective.`;

  return getCompletion(prompt, "You are a senior data analytics officer.", 0.5);
}

/**
 * Intelligent follow-up generator
 */
export async function generateFollowups(question: string, sql: string, rows: any[]): Promise<string[]> {
  const subset = rows.slice(0, 5);
  const prompt = `
User Question: "${question}"
SQL Statement:
${sql}
Sample Rows:
${JSON.stringify(subset)}

Based on the question topic and results, suggest 3 natural, logical follow-up questions a creative data analyst would ask.
Return and format your output as a raw JSON array of 3 strings. Do not include markdown brackets, code fences, or explanation. Example output:
["Which city has the highest average ExamPadi subscription volume?","List tech skills with a proficiency above 8 that aren't on ATHENA.","What is month-over-month user growth for ExamPadi AI in 2024?"]`;

  try {
    const rawResult = await getCompletion(prompt, "You are a metrics strategy director.", 0.4);
    let cleaned = rawResult.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    }
    const arr = JSON.parse(cleaned);
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.slice(0, 3);
    }
  } catch (e) {
    console.error("[QueryWiz AI] Failed to parse generated follow-up array:", e);
  }
  // Safe defaults based on schema
  return [
    "What is the total revenue of all live Jadai projects?",
    "Show the distribution of tech skills by category",
    "How many signups occurred on ExamPadi AI in April 2024?"
  ];
}
