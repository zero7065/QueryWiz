/**
 * SQL input and output validator for securing database interactions with multi-layered rules.
 */

export interface ValidationResult {
  isValid: boolean;
  message: string | null;
}

/**
 * Validates a generated SQL statement before execution to ensure read-only safety,
 * low-complexity constraints, and prevention of injection vectors.
 */
export function validateSQL(sql: string): ValidationResult {
  const trimmed = sql.trim();

  if (!trimmed) {
    return { isValid: false, message: "Query text is empty." };
  }

  // --- Layer 3: Complexity Limits (Part A - Length limit) ---
  if (trimmed.length > 2000) {
    return { isValid: false, message: "Query blocked: too complex (query exceeds 2000 characters limit)." };
  }

  // Must begin with SELECT
  if (!trimmed.toLowerCase().startsWith("select") && !trimmed.toLowerCase().startsWith("set search_path")) {
    return { isValid: false, message: "Only SELECT queries are authorized to run on this database." };
  }

  // --- Layer 1: Keyword Blocklist ---
  const blockedKeywords = [
    /\bdrop\b/i,
    /\bdelete\b/i,
    /\bupdate\b/i,
    /\binsert\b/i,
    /\balter\b/i,
    /\bcreate\b/i,
    /\btruncate\b/i,
    /\bgrant\b/i,
    /\brevoke\b/i,
    /--/,                    // Standard comment
    /\/\*/,                  // Multi-line comment
  ];

  for (const regex of blockedKeywords) {
    if (regex.test(trimmed)) {
      return { 
        isValid: false, 
        message: "Query blocked: contains destructive keyword" 
      };
    }
  }

  // --- Layer 2: System Table Access Block ---
  const FORBIDDEN_SCHEMAS = [
    /\bpg_catalog\b/i, 
    /\binformation_schema\b/i, 
    /\bpg_toast\b/i, 
    /\bpg_temp\b/i, 
    /\bpg_internal\b/i
  ];
  for (const regex of FORBIDDEN_SCHEMAS) {
    if (regex.test(trimmed)) {
      return {
        isValid: false,
        message: "Query blocked: attempts to access system tables"
      };
    }
  }

  // --- Layer 3: Complexity Limits (Part B - Joins & Subqueries) ---
  // Match 'JOIN' keywords
  const joinMatches = trimmed.match(/\bjoin\b/gi);
  if (joinMatches && joinMatches.length > 5) {
    return {
      isValid: false,
      message: "Query blocked: too complex (max 5 JOINs)"
    };
  }

  // Subquery identification: count opening parentheses followed by potential select phrases
  const subqueryMatches = trimmed.match(/\(\s*select\b/gi);
  if (subqueryMatches && subqueryMatches.length > 3) {
    return {
      isValid: false,
      message: "Query blocked: too complex (max 3 subqueries)"
    };
  }

  // --- Layer 4: Injection Vectors ---
  const injectionPatterns = [
    /\bunion\s+select\b/i,
    /\bexec\b\(/i,
    /\bexecute\b\(/i,
    /\bxp_cmdshell\b/i,
    /\bcast\b\(\s*0x/i,
    /\bconvert\b\(\s*0x/i,
    /\bchar\b\(/i,
    /\bwaitfor\s+delay\b/i
  ];

  for (const regex of injectionPatterns) {
    if (regex.test(trimmed)) {
      return {
        isValid: false,
        message: "Query blocked: potential injection pattern detected"
      };
    }
  }

  // --- Layer 5: Statement Count Checking ---
  // Ensure we don't cheat by packaging multiple queries separated by semicolons
  const statements = trimmed.split(";").map(s => s.trim()).filter(Boolean);
  if (statements.length > 1) {
    // If the statements only contain SET search_path and one SELECT, we allow it (handled in router/db explicitly)
    const activeStatements = statements.filter(s => !s.toLowerCase().startsWith("set search_path"));
    if (activeStatements.length > 1) {
      return {
        isValid: false,
        message: "Chained queries using semicolons are prohibited for security."
      };
    }
  }

  return { isValid: true, message: null };
}
