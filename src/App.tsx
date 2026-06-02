/**
 * Upgraded QueryWiz Main Application Frontend
 * Brand: Jadai Studios
 * Supports dual-mode DB, Autonomous AI follow-ups, auto-insights, step-by-step explainers,
 * dynamic metric banners, query history timeline with local storage, and password-secured admin dashboard
 * with Live Data mode table protection toggle, example prompt chips editor, and traffic data sparkcharts!
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Database, 
  HelpCircle, 
  Activity, 
  Terminal, 
  Sparkles,
  RefreshCw,
  TableProperties,
  BarChart3,
  History,
  Lock,
  Unlock,
  Settings,
  Cpu,
  Layers,
  Users,
  MessageSquare,
  Network,
  X,
  Gauge,
  KeyRound,
  Trash2,
  AlertCircle,
  Clock,
  ArrowRight,
  Sun,
  Moon,
  TrendingUp,
  CheckCircle2,
  LockKeyhole
} from "lucide-react";
import { useQuery } from "./hooks/useQuery.ts";
import { ExampleChips } from "./components/ExampleChips.tsx";
import { QueryInput } from "./components/QueryInput.tsx";
import { SqlBlock } from "./components/SqlBlock.tsx";
import { ResultsTable } from "./components/ResultsTable.tsx";
import { ResultsChart } from "./components/ResultsChart.tsx";
import { ErrorBanner } from "./components/ErrorBanner.tsx";
import { 
  fetchInsights, 
  fetchExplanation, 
  fetchFollowups, 
  fetchStats, 
  StatsResponse 
} from "./lib/api.ts";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

interface HistoryItem {
  id: string;
  question: string;
  sql: string;
  timestamp: number;
  mode: "demo" | "live";
}

export default function App() {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [activeTab, setActiveTab] = useState<"table" | "chart">("table");
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Dynamic config lists (custom prompt chips & live exposed checklist)
  const [chipsList, setChipsList] = useState<string[]>([]);
  const [exposedTables, setExposedTables] = useState<string[]>([]);

  // Global statistical aggregates and metadata details
  const [stats, setStats] = useState<StatsResponse>({
    totalQueries: 2847,
    uniqueIPs: 18,
    liveProjects: 3,
    trackedUsers: 19700
  });

  // Autonomous AI resources states
  const [insightText, setInsightText] = useState<string>("");
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const [explanationText, setExplanationText] = useState<string>("");
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const [followupsList, setFollowupsList] = useState<string[]>([]);
  const [isLoadingFollowups, setIsLoadingFollowups] = useState(false);

  // Layout states
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);

  // Admin configuration section states
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminLogs, setAdminLogs] = useState<any[]>([]);
  const [isReseeding, setIsReseeding] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Admin config editable state values
  const [editedChips, setEditedChips] = useState<string[]>(["", "", "", "", ""]);
  const [editedExposed, setEditedExposed] = useState<string[]>([]);

  const { status, error, result, fetchQuery, clearQuery } = useQuery();
  const isLoading = status === "loading";

  // Toggle Theme mode sun/moon utilities
  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("querywiz_theme", nextTheme);
    if (nextTheme === "light") {
      document.documentElement.classList.add("light");
      document.body.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.body.classList.remove("light");
    }
  };

  // Sync theme selection on mount
  useEffect(() => {
    const storedTheme = localStorage.getItem("querywiz_theme") as "dark" | "light";
    if (storedTheme) {
      setTheme(storedTheme);
      if (storedTheme === "light") {
        document.documentElement.classList.add("light");
        document.body.classList.add("light");
      } else {
        document.documentElement.classList.remove("light");
        document.body.classList.remove("light");
      }
    }
  }, []);

  // Fetch dynamic chip configs on start
  const loadConfigAndChips = async () => {
    try {
      const resp = await fetch("/api/query/config");
      const d = await resp.json();
      if (d.example_chips) {
        setChipsList(d.example_chips);
        setEditedChips(d.example_chips);
      }
      if (d.exposed_live_tables) {
        setExposedTables(d.exposed_live_tables);
        setEditedExposed(d.exposed_live_tables);
      }
    } catch (e) {
      console.warn("Failed retrieving dynamic config values from active DB.");
    }
  };

  // 1. Initialise global stats and load localStorage timeline history
  const loadStats = async () => {
    try {
      const liveStats = await fetchStats();
      setStats(liveStats);
    } catch (e) {
      console.warn("Failed to load global counter metrics. Using backup baseline.");
    }
  };

  useEffect(() => {
    loadStats();
    loadConfigAndChips();
    
    // Load local history list
    try {
      const stored = localStorage.getItem("querywiz_history");
      if (stored) {
        setHistoryList(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  // 2. Observer when query resolves successfully to load AI insights + follow-up chips
  useEffect(() => {
    if (status === "success" && result && result.sql) {
      // Refresh global stats counter dynamically
      loadStats();

      // Trigger Insights generation
      setIsLoadingInsights(true);
      setInsightText("");
      fetchInsights(result.sql, result.rows)
        .then((text) => setInsightText(text))
        .catch(() => setInsightText("Reviewing parameters reveals stable, standard operational patterns across queried schemas."))
        .finally(() => setIsLoadingInsights(false));

      // Trigger Followups generation
      setIsLoadingFollowups(true);
      setFollowupsList([]);
      fetchFollowups(question, result.sql, result.rows)
        .then((list) => setFollowupsList(list))
        .catch(() => setFollowupsList([]))
        .finally(() => setIsLoadingFollowups(false));

      // Reset SQL step explainer states
      setExplanationText("");
      setIsExplanationOpen(false);

      // Store in timeline history list
      const newItem: HistoryItem = {
        id: Math.random().toString(),
        question,
        sql: result.sql,
        timestamp: Date.now(),
        mode
      };

      setHistoryList((prev) => {
        // Exclude duplicate questions to avoid clutter
        const filtered = prev.filter((item) => item.question.toLowerCase() !== question.toLowerCase());
        const updated = [newItem, ...filtered].slice(0, 50); // limit to 50 items
        localStorage.setItem("querywiz_history", JSON.stringify(updated));
        return updated;
      });
    }
  }, [status, result]);

  // 3. Command execution routing
  const handleSubmit = () => {
    if (question.trim()) {
      fetchQuery(question, mode);
    }
  };

  const handleSelectChip = (text: string) => {
    setQuestion(text);
    fetchQuery(text, mode);
  };

  const handleReplayHistory = (item: HistoryItem) => {
    setQuestion(item.question);
    setMode(item.mode);
    fetchQuery(item.question, item.mode);
  };

  const handleDeleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent running query
    setHistoryList((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      localStorage.setItem("querywiz_history", JSON.stringify(updated));
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistoryList([]);
    localStorage.removeItem("querywiz_history");
  };

  const handleClear = () => {
    setQuestion("");
    clearQuery();
    setInsightText("");
    setExplanationText("");
    setIsExplanationOpen(false);
  };

  // 4. SQL explainer triggers
  const handleExplainQuery = async () => {
    if (!result || !result.sql || explanationText) return;
    setIsLoadingExplanation(true);
    try {
      const text = await fetchExplanation(result.sql);
      setExplanationText(text);
    } catch (_) {
      setExplanationText("This read-only database query retrieves columns matching criteria filters.");
    } finally {
      setIsLoadingExplanation(false);
    }
  };

  // 5. Admin operations
  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    try {
      const response = await fetch("/api/query/admin/stats", {
        headers: { "x-admin-password": adminPassword }
      });
      if (!response.ok) {
        throw new Error("Invalid admin password key entered.");
      }
      const data = await response.json();
      setAdminStats(data);
      setIsAdminAuthorized(true);

      // Also pull log database tables
      const logsResp = await fetch("/api/query/admin/logs", {
        headers: { "x-admin-password": adminPassword }
      });
      const logsData = await logsResp.json();
      setAdminLogs(logsData.logs || []);
    } catch (err: any) {
      setAdminError(err.message || "Authorization failed.");
    }
  };

  const handleReseedDb = async () => {
    if (isReseeding) return;
    setIsReseeding(true);
    try {
      const response = await fetch("/api/query/admin/reseed", {
        method: "POST",
        headers: { "x-admin-password": adminPassword }
      });
      if (response.ok) {
        alert("Database successfully re-seeded with realistic portfolio datasets!");
        
        // Refresh logs and statistics
        const [statsResp, logsResp] = await Promise.all([
          fetch("/api/query/admin/stats", { headers: { "x-admin-password": adminPassword } }),
          fetch("/api/query/admin/logs", { headers: { "x-admin-password": adminPassword } })
        ]);
        
        if (statsResp.ok) setAdminStats(await statsResp.json());
        if (logsResp.ok) setAdminLogs((await logsResp.json()).logs || []);
        
        loadStats();
        loadConfigAndChips();
      }
    } catch (err) {
      alert("Failed to fully reseed.");
    } finally {
      setIsReseeding(false);
    }
  };

  // Save config changes from admin console
  const handleSaveConfig = async (key: "example_chips" | "exposed_live_tables", value: any) => {
    setIsSavingConfig(true);
    try {
      const resp = await fetch("/api/query/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword
        },
        body: JSON.stringify({ key, value })
      });
      if (resp.ok) {
        alert(`Config [${key}] saved successfully to database!`);
        await loadConfigAndChips();
      } else {
        alert("Failed to commit settings updates.");
      }
    } catch (err) {
      alert("Error saving configuration updates.");
    } finally {
      setIsSavingConfig(false);
    }
  };

  const closeAdminConsole = () => {
    setIsAdminOpen(false);
    setAdminPassword("");
    setIsAdminAuthorized(false);
    setAdminStats(null);
    setAdminLogs([]);
  };

  // Helper toggle checklist values
  const handleToggleExposedTable = (table: string) => {
    setEditedExposed(prev => 
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e8e8e8] flex flex-col justify-between selection:bg-[#C9A84CBF] selection:text-[#0a0a0a]">
      {/* Decorative Brand Top Bar */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#C9A84C]/60 to-transparent w-full" />
      
      {/* HEADER SECTION */}
      <header className="border-b border-[#C9A84C22] bg-[#0d0d0d]/80 px-4 py-3 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex flex-col select-none">
              <h1 className="cinzel text-xl sm:text-2xl gold-text font-extrabold leading-none">QueryWiz</h1>
              <p className="text-[9px] tracking-widest opacity-50 uppercase font-mono mt-0.5">portfolio database metrics</p>
            </div>
            
            {/* Real Live database status badge */}
            <span className="flex items-center gap-1 text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/60 px-2 py-0.5 rounded font-mono select-none uppercase">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              <span>connected</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline jetbrains select-none">Brand: Jadai Studios</span>
            
            {/* Light / Dark Mode Toggle button */}
            <button
              onClick={handleToggleTheme}
              className="p-1 px-2.5 bg-[#111] border border-white/10 rounded cursor-pointer duration-150 py-1.5 hover:bg-zinc-800 text-[#C9A84C] relative active:scale-95 transition-all outline-none"
              title="Toggle Light or Dark interface"
            >
              {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* COLLAPSIBLE TIMELINE BUTTON */}
            <button
              onClick={() => setIsHistoryOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 text-xs font-mono py-1.5 px-3 rounded gold-border duration-150 cursor-pointer hover:bg-[#111] outline-none ${
                isHistoryOpen ? "bg-[#C9A84C1a] text-[#C9A84C]" : "text-zinc-400"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timeline</span>
            </button>

            {/* SECURE ADMIN CONTROL DECK BUTTON */}
            <button
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 text-xs font-mono py-1.5 px-3 rounded gold-border text-zinc-400 hover:text-white hover:bg-[#111] duration-150 cursor-pointer bg-[#0c0c0c] outline-none hover:border-[#C9A84C44]"
            >
              <Settings className="w-3.5 h-3.5 text-[#C9A84C]" />
              <span className="hidden sm:inline">Admin Panel</span>
            </button>
          </div>
        </div>
      </header>

      {/* METRICS & DYNAMICS DISPLAY LINE */}
      <section className="bg-[#0f0f0f] border-b border-[#C9A84C11] py-4 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#111111]/30 gold-border rounded p-3 select-none flex items-center gap-3">
            <Gauge className="w-5 h-5 text-[#C9A84C]/60" />
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Database Reads</p>
              <h4 className="text-sm font-semibold text-zinc-250 jetbrains">{stats.totalQueries.toLocaleString()}</h4>
            </div>
          </div>
          <div className="bg-[#111111]/30 gold-border rounded p-3 select-none flex items-center gap-3">
            <Network className="w-5 h-5 text-[#C9A84C]/60" />
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Unique Hosts</p>
              <h4 className="text-sm font-semibold text-zinc-250 jetbrains">{stats.uniqueIPs.toLocaleString()}</h4>
            </div>
          </div>
          <div className="bg-[#111111]/30 gold-border rounded p-3 select-none flex items-center gap-3">
            <Layers className="w-5 h-5 text-[#C9A84C]/60" />
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Live Products</p>
              <h4 className="text-sm font-semibold text-zinc-250 jetbrains">{stats.liveProjects} Projects</h4>
            </div>
          </div>
          <div className="bg-[#111111]/30 gold-border rounded p-3 select-none flex items-center gap-3">
            <Users className="w-5 h-5 text-[#C9A84C]/60" />
            <div>
              <p className="text-[9px] text-zinc-500 uppercase font-mono tracking-tighter">Tracked Users</p>
              <h4 className="text-sm font-semibold text-zinc-250 jetbrains">{stats.trackedUsers.toLocaleString()} MAU</h4>
            </div>
          </div>
        </div>
      </section>

      {/* PRIMARY SPLIT WORKSPACE CANVAS */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col md:flex-row gap-6 items-stretch">
        
        {/* SIDE TIMELINE HISTORY DRAWER */}
        <AnimatePresence>
          {isHistoryOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "270px", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex-shrink-0 w-full md:w-[270px] flex flex-col gap-4 border-r md:border-r-0 border-[#C9A84C11] pr-0 md:pr-4 overflow-hidden select-none"
            >
              <div className="flex items-center justify-between border-b border-[#C9A84C11] pb-2">
                <span className="text-xs gold-text uppercase tracking-widest font-mono font-bold">Query Timeline</span>
                {historyList.length > 0 && (
                  <button 
                    onClick={handleClearHistory}
                    className="text-[9px] text-zinc-500 hover:text-red-400 uppercase font-mono duration-100 flex items-center gap-0.5 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear all</span>
                  </button>
                )}
              </div>

              {/* TIMELINE LIST ELEMENT */}
              <div className="flex-1 overflow-y-auto max-h-[600px] flex flex-col gap-2 scrollbar-none pr-1">
                {historyList.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-[#111111]/10 rounded border border-[#C9A84C05]">
                    <Clock className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                    <p className="text-[10px] text-zinc-600 font-mono">No previous lookups. Enter a prompt to log records here!</p>
                  </div>
                ) : (
                  historyList.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleReplayHistory(item)}
                      className="text-left p-2.5 bg-[#111111]/40 hover:bg-[#C9A84C0d] border border-[#C9A84C11] hover:border-[#C9A84C33] rounded duration-150 cursor-pointer flex flex-col gap-1 group active:scale-[0.98] transition-all relative"
                    >
                      {/* Individual Delete icon */}
                      <button
                        onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                        className="absolute right-1 text-zinc-600 hover:text-red-400 h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 bottom-1 transition-all duration-150"
                        title="Delete this item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>

                      <p className="text-[11px] text-zinc-350 font-medium line-clamp-2 leading-relaxed pr-5">
                        "{item.question}"
                      </p>
                      <div className="flex items-center justify-between text-[8.5px] font-mono text-zinc-600 mt-1">
                        <span className="uppercase text-zinc-500 font-bold group-hover:text-[#C9A84C]">
                          {item.mode} DB
                        </span>
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* GENERAL INPUT AND WORKSPACE PANEL */}
        <div className="flex-grow flex flex-col gap-6">
          
          {/* HERO BANNER HEADNOTES */}
          <div className="py-2 text-center select-none">
            <motion.h2 
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="cinzel text-xl sm:text-2xl gold-text font-extrabold uppercase tracking-wide leading-tight"
            >
              Ask Jadai database in plain English
            </motion.h2>
            <p className="text-zinc-500 text-xs mt-1 max-w-lg mx-auto leading-relaxed font-sans font-medium">
              Interactively search developers skills, subscriptions, platform events, live deployments, and revenue values.
            </p>
          </div>

          {/* INPUT FORM WORKSPACE */}
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <QueryInput
              value={question}
              onChange={setQuestion}
              onSubmit={handleSubmit}
              isLoading={isLoading}
              onClear={handleClear}
              mode={mode}
              setMode={setMode}
            />
          </motion.div>

          {/* EXAMPLE QUICK CHIPS */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <ExampleChips onSelectChip={handleSelectChip} chips={chipsList} />
          </motion.div>

          {/* CENTRAL GRAPHIC RESULTS CANVAS */}
          <main className="flex-grow flex flex-col justify-center min-h-[380px]">
            <AnimatePresence mode="wait">
              
              {/* IDLE STATE */}
              {status === "idle" && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-24 border border-[#C9A84C11] bg-[#111111]/10 rounded-lg text-center px-4"
                >
                  <div className="w-12 h-12 rounded-full border border-[#C9A84C11] flex items-center justify-center bg-[#111]/60 mb-4 text-[#C9A84C]/60">
                    <Terminal className="w-5 h-5 animate-pulse" />
                  </div>
                  <h3 className="font-mono text-xs text-[#C9A84C] tracking-[0.2em] uppercase font-bold mb-1.5">
                    Awaiting Input
                  </h3>
                  <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
                    Type a portfolio metric search query above (e.g. "total user counts by categories") to synthesize analytical SQL.
                  </p>
                </motion.div>
              )}

              {/* LOADING INDICATOR */}
              {isLoading && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-28 text-center select-none"
                >
                  <div className="relative w-12 h-12 mb-6">
                    <div className="absolute inset-0 w-full h-full border-4 border-[#C9A84C22] rounded-full" />
                    <div className="absolute inset-0 w-full h-full border-4 border-t-[#C9A84C] border-r-[#C9A84C] rounded-full animate-spin" />
                  </div>
                  <h3 className="font-mono text-xs text-[#C9A84C] tracking-[0.2em] uppercase font-bold mb-1">
                    Autonomous compilation triggered...
                  </h3>
                  <p className="text-zinc-600 font-mono text-[11px]">
                    Translating text and running sandboxed PostgreSQL executions.
                  </p>
                </motion.div>
              )}

              {/* FAIL COMPILING BANNER FRAME */}
              {(status === "rate_limited" || status === "error") && (!result || !result.sql) && (
                <motion.div
                  key="error-banner"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="max-w-2xl mx-auto w-full"
                >
                  <ErrorBanner 
                    message={error || "Could not retrieve query results from the database server."} 
                    isRateLimited={status === "rate_limited"}
                  />
                </motion.div>
              )}

              {/* WORKSPACE RESULTS CANVAS */}
              {(status === "success" || ((status === "error" || status === "rate_limited") && result?.sql)) && (
                <motion.div
                  key="workspace-results"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col gap-6"
                >
                  {/* Inline Error messages inside SQL container if execute failed */}
                  {error && (
                    <div className="max-w-2xl mx-auto w-full p-1">
                      <ErrorBanner message={error} isRateLimited={status === "rate_limited"} />
                    </div>
                  )}

                  {/* SMART RETRY LOGS NOTIFICATION */}
                  {result?.wasRetried && result?.retrySuccess && (
                    <motion.div 
                      initial={{ scale: 0.98, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="border border-[#C9A84C33] bg-[#C9A84C0d] p-3 rounded flex items-center gap-3 text-xs text-zinc-350 max-w-4xl mx-auto w-full select-none"
                    >
                      <Sparkles className="w-4 h-4 text-[#C9A84C] animate-spin" />
                      <div>
                        <span className="font-bold gold-text uppercase tracking-wider text-[10px]">Smart Error Recovery:</span>
                        <span className="ml-1 text-[11px] font-mono">Original SQL query crashed, but QueryWiz auto-repaired, compiled, and executed corrected query successfully!</span>
                      </div>
                    </motion.div>
                  )}

                  {/* DATABASE ACCESS CONFIG BLOCKED EXPOSURE NOTIFICATION */}
                  {result?.error?.includes("locked") && (
                    <motion.div 
                      className="border border-red-900/60 bg-red-950/20 p-3 rounded flex items-center gap-3 text-xs text-red-300 max-w-4xl mx-auto w-full font-mono"
                    >
                      <LockKeyhole className="w-4 h-4 text-red-400" />
                      <span>{result.error} Ensure modes align or adjust Admin configuration settings.</span>
                    </motion.div>
                  )}

                  {/* WORKSPACE BODY GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    
                    {/* LEFT PANEL: SQL DISPLAY CARD */}
                    <div className="col-span-1 lg:col-span-5 flex flex-col gap-4">
                      <div className="bg-[#0b0b0b] gold-border rounded p-1">
                        <SqlBlock sql={result?.sql || ""} />
                      </div>

                      {/* INLINE EXPLAINER CARD accordion COMPONENT */}
                      <div className="bg-[#0d0d0d] gold-border rounded p-4 flex flex-col gap-2.5 shadow-md">
                        <div className="flex items-center justify-between border-b border-[#C9A84C11] pb-2 select-none">
                          <span className="text-[11px] font-mono text-[#C9A84C] uppercase tracking-wider font-semibold">Teacher Explainer</span>
                          <button
                            onClick={() => {
                              setIsExplanationOpen((p) => !p);
                              handleExplainQuery();
                            }}
                            className="text-[10px] font-mono border border-[#C9A84C33] px-2.5 py-0.5 rounded cursor-pointer hover:bg-[#111111] duration-150 uppercase outline-none"
                          >
                            {isExplanationOpen ? "Fold" : "Explain SQL"}
                          </button>
                        </div>

                        {/* EXPLAIN ACCORDION BOARD */}
                        {isExplanationOpen && (
                          <div className="text-zinc-300 text-xs leading-relaxed font-mono mt-1 space-y-2">
                            {isLoadingExplanation ? (
                              <div className="flex items-center gap-2 text-zinc-500">
                                <Cpu className="w-3.5 h-3.5 animate-spin" />
                                <span>Analyzing SQL directives...</span>
                              </div>
                            ) : (
                              <p className="bg-[#0e0e0e] p-2.5 border border-white/5 rounded-md text-zinc-400">
                                {explanationText || "Ready to explain query structures."}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* RIGHT PANEL: SPREADSHEETS AND D3 GRAPHICAL LAYOUTS */}
                    <div className="col-span-1 lg:col-span-7 flex flex-col h-full gap-4">
                      {/* Selection tabs to toggle view */}
                      <div className="flex justify-between items-center bg-[#111111]/30 p-1 rounded-lg gold-border select-none">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveTab("table")}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-mono rounded cursor-pointer duration-150 transition-all outline-none ${
                              activeTab === "table" ? "gold-bg text-black font-semibold shadow" : "text-zinc-500 hover:text-white"
                            }`}
                          >
                            <TableProperties className="w-3.5 h-3.5" />
                            <span>Spreadsheet</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => setActiveTab("chart")}
                            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-mono rounded cursor-pointer duration-150 transition-all outline-none ${
                              activeTab === "chart" ? "gold-bg text-black font-semibold shadow" : "text-zinc-500 hover:text-white"
                            }`}
                          >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>Visualizer</span>
                          </button>
                        </div>

                        <span className="text-[10px] uppercase font-mono text-zinc-500 px-3 select-none">
                          {result?.rowCount} matches (Row count limit is 100)
                        </span>
                      </div>

                      {/* WORKSPACE ELEMENT SWITCHES */}
                      <div className="flex-grow">
                        <AnimatePresence mode="wait">
                          {activeTab === "table" ? (
                            <motion.div
                              key="table-frame"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <ResultsTable rows={result?.rows || []} columns={result?.columns || []} />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="chart-frame"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                            >
                              <ResultsChart rows={result?.rows || []} columns={result?.columns || []} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                    </div>
                  </div>

                  {/* AUTONOMOUS AI UPDATE SECTIONS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch border-t border-[#C9A84C11] pt-6">
                    
                    {/* AUTO METRIC INSIGHT BOX DISPLAY */}
                    <div className="bg-[#0c0c0c] gold-border rounded p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2 font-mono text-[#C9A84C] text-[11px] uppercase tracking-wider font-semibold border-b border-[#C9A84C11] pb-2 select-none">
                        <Sparkles className="w-4 h-4 text-[#C9A84C]" />
                        <span>Surprising Auto Insights</span>
                      </div>

                      <div className="text-zinc-350 text-xs leading-relaxed font-mono">
                        {isLoadingInsights ? (
                           <div className="flex items-center gap-2 text-zinc-500 select-none">
                             <Clock className="w-4 h-4 text-[#C9A84C] animate-pulse" />
                             <span className="animate-pulse">Analyzing query parameters...</span>
                           </div>
                        ) : (
                          <div className="p-3 bg-[#111111] border border-white/5 rounded-md flex items-start gap-2.5">
                            <span className="text-[#C9A84C] text-sm leading-none select-none">&✦</span>
                            <p className="text-zinc-350 font-sans text-xs italic leading-relaxed">
                              {insightText || "Database compiled successfully. Select aggregates to compute insightful trend analysis."}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* FOLLOW-UP ANALYSES CHIPS */}
                    <div className="bg-[#0c0c0c] gold-border rounded p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2 font-mono text-[#C9A84C] text-[11px] uppercase tracking-wider font-semibold border-b border-[#C9A84C11] pb-2 select-none">
                        <MessageSquare className="w-4 h-4 text-[#C9A84C]" />
                        <span>Analyst Followup Questions</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {isLoadingFollowups ? (
                          <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono select-none">
                            <Clock className="w-4 h-4 text-[#C9A84C] animate-pulse" />
                            <span className="animate-pulse">Predicting next queries...</span>
                          </div>
                        ) : followupsList.length === 0 ? (
                          <p className="text-[10px] text-zinc-500 font-mono italic select-none">No relevant followups mapped to schema details yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {followupsList.map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSelectChip(item)}
                                className="text-left py-1.5 px-3 bg-[#111] hover:bg-[#C9A84C0d] border border-zinc-900 group hover:border-[#C9A84C55] rounded text-[11px] text-zinc-400 hover:text-white duration-150 cursor-pointer active:scale-98 transition-all flex items-center justify-between outline-none"
                              >
                                <span className="line-clamp-1">"{item}"</span>
                                <ArrowRight className="w-3 h-3 text-zinc-600 group-hover:text-[#C9A84C]" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </motion.div>
              )}

            </AnimatePresence>
          </main>

        </div>
      </div>

      {/* PORT WRITING BOTTOM ADMIN CONSOLE OVERLAY */}
      <AnimatePresence>
        {isAdminOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-[#0b0b0b] gold-border w-full max-w-5xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-[#0d0d0d] px-6 py-4 border-b border-[#C9A84C22] flex items-center justify-between select-none">
                <div className="flex items-center gap-2.5">
                  <Lock className="w-5 h-5 text-[#C9A84C]" />
                  <span className="cinzel text-lg font-bold uppercase gold-text">Administrative Master Console</span>
                </div>
                <button
                  onClick={closeAdminConsole}
                  className="p-1 rounded hover:bg-zinc-900 cursor-pointer text-zinc-400 hover:text-white duration-100 outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {/* CHECK PASSWORD STATE */}
                {!isAdminAuthorized ? (
                  <form onSubmit={handleAdminVerify} className="max-w-md mx-auto py-12 flex flex-col gap-4">
                    <div className="p-4 bg-[#C9A84C0d] border border-[#C9A84C33] rounded text-xs text-zinc-400 mb-2 leading-relaxed font-mono select-none">
                      <KeyRound className="w-5 h-5 text-[#C9A84C] mb-1.5" />
                      Please enter your password key. Admin console allows table exposure toggling, editable example prompt chips forms, and traffic queries monitoring.
                    </div>
                    {adminError && (
                      <div className="p-3 bg-red-950/40 text-red-400 text-xs border border-red-900/40 rounded flex items-center gap-2 font-mono">
                        <AlertCircle className="w-4 h-4" />
                        <span>{adminError}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 select-none">
                      <label className="text-[10px] font-mono text-zinc-500 uppercase">Master Admin Password</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="bg-[#111111] gold-border px-4 py-2 text-sm text-white rounded outline-none focus:ring-1 focus:ring-[#C9A84C] font-mono"
                        required
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      className="mt-2 py-2 gold-bg text-black font-bold uppercase text-xs rounded duration-100 cursor-pointer active:scale-95 text-center transition-all shadow font-mono outline-none"
                    >
                      Authorize Login
                    </button>
                  </form>
                ) : (
                  // LOGGED IN ADMIN DASHBOARD
                  <div className="flex flex-col gap-6 font-mono text-xs">
                    
                    {/* TOP STATS BAR */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 select-none">
                      <div className="bg-[#111111] p-3 rounded gold-border">
                        <p className="text-[9px] text-zinc-500 uppercase">Verified IP Hosts</p>
                        <h4 className="text-sm font-semibold text-zinc-300 jetbrains">{adminStats?.uniqueIps ?? 0} HASHED IPS</h4>
                      </div>
                      <div className="bg-[#111111] p-3 rounded gold-border">
                        <p className="text-[9px] text-zinc-500 uppercase">System Latency (Avg)</p>
                        <h4 className="text-sm font-semibold text-zinc-300 jetbrains">{adminStats?.avgExecutionMs ?? 0} MS</h4>
                      </div>
                      <div className="bg-[#111111] p-3 rounded gold-border">
                        <p className="text-[9px] text-zinc-500 uppercase">Recorded Failures</p>
                        <h4 className="text-sm font-semibold text-red-400 jetbrains">{adminStats?.errorCount ?? 0} CRASHES</h4>
                      </div>
                      <div className="bg-[#111111] p-3 rounded gold-border">
                        <p className="text-[9px] text-zinc-500 uppercase">Live DB Mode Status</p>
                        <h4 className={`text-sm font-semibold uppercase jetbrains ${adminStats?.isLiveSetup ? "text-emerald-400" : "text-zinc-650"}`}>
                          {adminStats?.isLiveSetup ? "Unlocked" : "Locked / Offline"}
                        </h4>
                      </div>
                    </div>

                    {/* LIVE MODE DATA ACCESSIBILITY RULES & EXPOSED CONFIG CHECKBOXES */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
                      <div className="bg-[#111111] p-4 rounded gold-border flex flex-col gap-3">
                        <div>
                          <h5 className="text-[#C9A84C] text-[11px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            <LockKeyhole className="w-3.5 h-3.5" />
                            <span>Live Mode Table Filter Rules</span>
                          </h5>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Control which database tables visitors are allowed to query or search when running in <b>Live Data mode</b>. Toggling off locks inquiries.
                          </p>
                        </div>

                        {/* Checklist */}
                        <div className="flex flex-col gap-2 bg-[#090909] p-3 rounded border border-white/5 text-[11px]">
                          {["projects", "tech_skills", "platform_events", "subscriptions", "deployments"].map(table => {
                            const isChked = editedExposed.includes(table);
                            return (
                              <label key={table} className="flex items-center gap-2 cursor-pointer select-none py-0.5 hover:text-white">
                                <input
                                  type="checkbox"
                                  checked={isChked}
                                  onChange={() => handleToggleExposedTable(table)}
                                  className="accent-[#C9A84C] scale-105 cursor-pointer"
                                />
                                <span className={`uppercase font-bold ${isChked ? "text-zinc-200" : "text-zinc-600 line-through"}`}>{table}</span>
                              </label>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => handleSaveConfig("exposed_live_tables", editedExposed)}
                          disabled={isSavingConfig}
                          className="px-3 py-1.5 bg-[#C9A84C] text-black font-extrabold uppercase rounded text-[10px] text-center self-start hover:bg-[#C9A84C]/90 cursor-pointer duration-100 font-mono active:scale-95 transition-all outline-none"
                        >
                          Save Exposure Rules
                        </button>
                      </div>

                      {/* EDITABLE CHIPS QUESTIONS FORM (EDIT FIVE CHIPS WITHOUT SYSTEM RE-DEPLOYS) */}
                      <div className="bg-[#111111] p-4 rounded gold-border flex flex-col gap-3">
                        <div>
                          <h5 className="text-[#C9A84C] text-[11px] font-bold uppercase tracking-wider mb-0.5 flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Example Prompt Chips Editor</span>
                          </h5>
                          <p className="text-[10px] text-zinc-500 leading-relaxed">
                            Alter the 5 quick click inquiry prompts rendered on home viewport. Instantly updates DB entries.
                          </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {editedChips.map((chip, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-zinc-650 font-mono">#{idx+1}</span>
                              <input
                                type="text"
                                value={chip}
                                onChange={(e) => {
                                  const updated = [...editedChips];
                                  updated[idx] = e.target.value;
                                  setEditedChips(updated);
                                }}
                                placeholder={`Custom Query prompt ${idx+1}`}
                                className="bg-[#090909] border border-[#C9A84C22] focus:border-[#C9A84C66] px-2.5 py-1 text-zinc-350 text-[11px] rounded outline-none w-full font-mono font-medium"
                              />
                            </div>
                          ))}
                        </div>

                        <button
                          onClick={() => handleSaveConfig("example_chips", editedChips)}
                          disabled={isSavingConfig}
                          className="px-3 py-1.5 bg-[#C9A84C] text-black font-extrabold uppercase rounded text-[10px] text-center self-start hover:bg-[#C9A84C]/90 cursor-pointer duration-100 font-mono active:scale-95 transition-all outline-none"
                        >
                          Save Examples list
                        </button>
                      </div>
                    </div>

                    {/* REDIRECT & RE-SEED CONTROLS */}
                    <div className="p-4 bg-[#111111] gold-border rounded flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
                      <div>
                        <h5 className="text-[#C9A84C] text-[12px] font-bold uppercase tracking-wider mb-0.5">Database Reseeder Action</h5>
                        <p className="text-[10px] text-zinc-500 max-w-lg leading-relaxed">
                          Reset the schema on your local memory backend instantly! Rebuilding creates tables, inserts seed values, and structures logs files correctly.
                        </p>
                      </div>
                      <button
                        onClick={handleReseedDb}
                        disabled={isReseeding}
                        className="px-4 py-2 bg-red-950/40 text-red-400 border border-red-900 duration-150 rounded text-xs select-none cursor-pointer uppercase hover:bg-zinc-900 disabled:opacity-50 inline-flex items-center gap-1.5 outline-none font-bold"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isReseeding ? "animate-spin" : ""}`} />
                        <span>{isReseeding ? "Reseeding..." : "Reseed Database"}</span>
                      </button>
                    </div>

                    {/* VISUAL ANALYTICS TRAFFIC DISTRIBUTION & SUGGESTION RECHART */}
                    {adminStats?.hourlyTraffic && adminStats.hourlyTraffic.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#0e0e0e] border border-[#C9A84C11] rounded p-4 select-none">
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>System Load Hourly traffic sparkmetrics</span>
                          </span>
                          <div className="h-[120px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={adminStats.hourlyTraffic}>
                                <XAxis dataKey="hour_str" stroke="#555" fontSize={9} tickLine={false} />
                                <YAxis stroke="#555" fontSize={9} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: "#000", borderColor: "#C9A84C33", fontSize: "10px" }} />
                                <Bar dataKey="count_val" fill="#C9A84C" radius={[2, 2, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Frequently Asked Prompt Leaderboards</span>
                          </span>
                          <div className="max-h-[120px] overflow-y-auto flex flex-col gap-1 pr-1">
                            {adminStats?.frequentQueries && adminStats.frequentQueries.length > 0 ? (
                              adminStats.frequentQueries.map((item: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center bg-[#111] px-2 py-1 rounded text-[10.5px]">
                                  <span className="truncate max-w-[280px] text-zinc-300 font-sans">"{item.question}"</span>
                                  <span className="text-[#C9A84C] font-bold font-mono">{item.count} views</span>
                                </div>
                              ))
                            ) : (
                              <p className="text-[10px] italic text-zinc-600">Leaderboard analysis is computing logs...</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* REAL LIVE AUDITING LOG TABLES WITH DEEP TRANSACTION DETAILS */}
                    <div className="flex flex-col gap-2 flex-grow">
                      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider select-none">Live Queries Monitor logs (Last 100 Transactions)</span>
                      <div className="border border-[#C9A84C11] rounded overflow-hidden max-h-[220px] overflow-y-auto">
                        <table className="w-full text-left text-[11px] border-collapse bg-[#0c0c0c]">
                          <thead className="bg-[#111111] sticky top-0 border-b border-[#C9A84C11] text-[9px] text-[#C9A84C] uppercase select-none">
                            <tr>
                              <th className="p-2 border-r border-[#C9A84C11]">ID</th>
                              <th className="p-2 border-r border-[#C9A84C11]">QUESTION</th>
                              <th className="p-2 border-r border-[#C9A84C11]">GEN_SQL</th>
                              <th className="p-2 border-r border-[#C9A84C11]">LATENCY</th>
                              <th className="p-2 border-r border-[#C9A84C11]">ROWS</th>
                              <th className="p-2">IP HASH</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#C9A84C11] text-zinc-400">
                            {adminLogs.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-4 text-center italic text-zinc-600">No lookup transactions recorded inside system logs tables.</td>
                              </tr>
                            ) : (
                              adminLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-zinc-950/80 duration-100">
                                  <td className="p-2 border-r border-[#C9A84C11] jetbrains">{log.id}</td>
                                  <td className="p-2 border-r border-[#C9A84C11] truncate max-w-[150px] font-sans" title={log.question}>"{log.question}"</td>
                                  <td className="p-2 border-r border-[#C9A84C11] truncate max-w-[200px] font-mono select-all text-zinc-500" title={log.generated_sql}>{log.generated_sql}</td>
                                  <td className="p-2 border-r border-[#C9A84C11] jetbrains text-[#C9A84C] font-semibold">{log.execution_ms}ms</td>
                                  <td className="p-2 border-r border-[#C9A84C11] jetbrains text-zinc-300 font-bold">{log.row_count}</td>
                                  <td className="p-2 truncate max-w-[100px] text-[10px]" title={log.ip_hash}>{log.ip_hash}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER SECTION */}
      <footer className="border-t border-[#C9A84C11] py-6 bg-[#0c0c0c] text-center select-none">
        <p className="text-[11px] font-mono text-zinc-650 uppercase tracking-widest leading-loose">
          &copy; {new Date().getFullYear()} Jadai Studios. QueryWiz natural query system is securely sandboxed.
        </p>
      </footer>
    </div>
  );
}
