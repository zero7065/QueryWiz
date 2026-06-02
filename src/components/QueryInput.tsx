/**
 * QueryInput component for QueryWiz
 * Features a custom-designed gold-bordered textarea with glow focus effects,
 * character count validation (max 2000), a rotating system placeholder, and a gold action button.
 */
import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, Database, Disc } from "lucide-react";

interface QueryInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  onClear: () => void;
  mode: "demo" | "live";
  setMode: (m: "demo" | "live") => void;
}

const ROTATING_PLACEHOLDERS = [
  "Which Jadai project has the most monthly users?",
  "Total revenue from ExamPadi subscriptions where plan_name = 'Annual'",
  "What is the average proficiency of our database skills?",
  "Show the version and deploy dates of all stable Railway deployments",
  "How many subscribers came from Lagos or Abuja during JAMB season?"
];

export function QueryInput({ 
  value, 
  onChange, 
  onSubmit, 
  isLoading, 
  onClear,
  mode,
  setMode
}: QueryInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState("");

  // Cycle placeholders with a nice fading typing effect
  useEffect(() => {
    let active = true;
    let text = ROTATING_PLACEHOLDERS[placeholderIndex];
    let charIdx = 0;
    let timer: NodeJS.Timeout;

    const tick = () => {
      if (!active) return;
      if (charIdx <= text.length) {
        setCurrentPlaceholder(text.substring(0, charIdx));
        charIdx++;
        timer = setTimeout(tick, 30);
      } else {
        // Wait 4 seconds then transition
        timer = setTimeout(() => {
          if (active) {
            setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
          }
        }, 4000);
      }
    };

    tick();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [placeholderIndex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  };

  const isLimitExceeded = value.length > 2000;

  return (
    <div className="w-full bg-[#111]/40 gold-border rounded-lg p-5 backdrop-blur-md">
      <div className="flex flex-col gap-4">
        
        {/* TEXT AREA INPUT FRAME */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="nl-question-input" className="text-xs gold-text uppercase tracking-widest block opacity-80 font-mono">
              Ask your database anything
            </label>
            
            {/* CHARACTER COUNTER */}
            <span className={`text-[10px] font-mono leading-none ${isLimitExceeded ? "text-red-400 font-bold animate-pulse" : "text-zinc-500"}`}>
              {value.length} / 2000 characters
            </span>
          </div>

          <div className="relative">
            <textarea
              id="nl-question-input"
              ref={textareaRef}
              rows={4}
              value={value}
              onChange={(e) => onChange(e.target.value.substring(0, 2010))}
              onKeyDown={handleKeyDown}
              placeholder={currentPlaceholder || "Ask a question about projects, skills, deployments..."}
              disabled={isLoading}
              className="w-full bg-[#111] gold-border text-[#e8e8e8] rounded-lg p-4 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-[#C9A84C] gold-glow transition-all duration-200 resize-none leading-relaxed font-sans placeholder-zinc-700"
            />
            <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1.5 pointer-events-none select-none text-[10px] font-mono text-zinc-600">
              <span className="jetbrains">CMD/Ctrl + Enter to execute</span>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR AND DUAL MODE CONFIGS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          
          {/* DATABASE SELECTION AND SCHEMATIC CONTROLS */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* TOGGLE CONTAINER */}
            <div className="flex items-center bg-[#090909] rounded-lg p-1 gold-border self-start">
              <button
                type="button"
                id="mode-demo-btn"
                onClick={() => setMode("demo")}
                className={`px-3 py-1 text-[10px] font-mono font-extrabold uppercase rounded cursor-pointer duration-200 transition-all ${
                  mode === "demo"
                    ? "gold-bg text-black shadow-md font-bold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Demo Data
              </button>
              <button
                type="button"
                id="mode-live-btn"
                onClick={() => setMode("live")}
                className={`px-3 py-1 text-[10px] font-mono font-extrabold uppercase rounded cursor-pointer duration-200 transition-all ${
                  mode === "live"
                    ? "bg-emerald-500 text-black shadow-md font-bold animate-pulse"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                Live DB
              </button>
            </div>

            {/* SCHEMA SUMMARY NOTE */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
              <Database className="w-3.5 h-3.5 text-[#C9A84C]/50" />
              <span className="jetbrains">
                Mapping: <span className="text-zinc-350">{mode === "demo" ? "jadai_demo (Jadai Portfolio)" : "external live DB"}</span>
              </span>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex items-center justify-end gap-3 select-none">
            {value && (
              <button
                type="button"
                id="clear-input-btn"
                onClick={onClear}
                disabled={isLoading}
                className="px-3 py-2 text-xs font-mono font-medium text-zinc-400 hover:text-white transition duration-250 cursor-pointer disabled:opacity-50 jetbrains"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              id="submit-query-btn"
              onClick={onSubmit}
              disabled={isLoading || !value.trim() || isLimitExceeded}
              className="px-5 py-2.5 text-xs font-bold tracking-wider text-black gold-bg rounded focus:outline-none cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-[0_2px_10px_rgba(201,168,76,0.15)] active:scale-[0.98] cinzel hover:opacity-90 disabled:opacity-30"
            >
              <span>{isLoading ? "THINKING..." : "ASK QUERYWIZ"}</span>
              {!isLoading && <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
