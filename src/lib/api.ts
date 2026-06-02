/**
 * API client helpers for QueryWiz supporting dual execution modes and AI features.
 */

export interface QueryResponse {
  sql: string | null;
  rows: any[];
  columns: string[];
  rowCount: number;
  error: string | null;
  status?: "rate_limited" | "error" | "success";
  wasRetried?: boolean;
  retrySuccess?: boolean;
  retryMessage?: string;
  isLiveConfigured?: boolean;
}

export interface StatsResponse {
  totalQueries: number;
  uniqueIPs: number;
  liveProjects: number;
  trackedUsers: number;
}

export async function askQueryWiz(question: string, mode: "demo" | "live" = "demo"): Promise<QueryResponse> {
  const response = await fetch("/api/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, mode }),
  });

  if (response.status === 429) {
    const errorData = await response.json();
    return {
      sql: null,
      rows: [],
      columns: [],
      rowCount: 0,
      error: errorData.error || "Too many requests. Rate limit is active.",
      status: "rate_limited",
    };
  }

  const data = await response.json();
  if (!response.ok) {
    return {
      sql: data.sql || null,
      rows: [],
      columns: [],
      rowCount: 0,
      error: data.error || "An error occurred during query translation.",
      status: "error",
    };
  }

  return {
    sql: data.sql,
    rows: data.rows,
    columns: data.columns,
    rowCount: data.rowCount,
    error: data.error,
    wasRetried: data.wasRetried,
    retrySuccess: data.retrySuccess,
    retryMessage: data.retryMessage,
    isLiveConfigured: data.isLiveConfigured,
    status: data.error ? "error" : "success",
  };
}

export async function fetchInsights(sql: string, rows: any[]): Promise<string> {
  const response = await fetch("/api/query/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql, rows }),
  });
  const data = await response.json();
  return data.insight || "";
}

export async function fetchExplanation(sql: string): Promise<string> {
  const response = await fetch("/api/query/explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  const data = await response.json();
  return data.explanation || "";
}

export async function fetchFollowups(question: string, sql: string, rows: any[]): Promise<string[]> {
  try {
    const response = await fetch("/api/query/followups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, sql, rows }),
    });
    const data = await response.json();
    return data.followups || [];
  } catch (err) {
    return [];
  }
}

export async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error("Failed to load header metrics.");
  }
  return response.json();
}
