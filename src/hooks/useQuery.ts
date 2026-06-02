/**
 * Custom hook to manage QueryWiz state and API interactions, incorporating DB modes.
 */
import { useState, useCallback } from "react";
import { askQueryWiz, QueryResponse } from "../lib/api.ts";

export type QueryStatus = "idle" | "loading" | "success" | "error" | "rate_limited";

export function useQuery() {
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResponse | null>(null);

  const fetchQuery = useCallback(async (question: string, mode: "demo" | "live" = "demo") => {
    if (!question.trim()) return;
    
    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const response = await askQueryWiz(question, mode);
      
      if (response.status === "rate_limited") {
        setStatus("rate_limited");
        setError(response.error);
        setResult(response);
      } else if (response.error) {
        setStatus("error");
        setError(response.error);
        setResult(response);
      } else {
        setStatus("success");
        setResult(response);
      }
    } catch (err: any) {
      console.error("[useQuery] Fetch error:", err);
      setStatus("error");
      setError(err?.message || "Could not reach the database server. Please verify your connection.");
    }
  }, []);

  const clearQuery = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
  }, []);

  return {
    status,
    error,
    result,
    fetchQuery,
    clearQuery,
  };
}
