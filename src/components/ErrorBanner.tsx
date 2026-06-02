/**
 * ErrorBanner component for QueryWiz
 * Displays security blockages, network errors, and runtime DB query execution slips elegantly.
 */
import React from "react";
import { AlertCircle, ShieldAlert, ZapOff } from "lucide-react";

interface ErrorBannerProps {
  message: string;
  isRateLimited?: boolean;
}

export function ErrorBanner({ message, isRateLimited }: ErrorBannerProps) {
  const isSecurity = message.toLowerCase().includes("security") || message.toLowerCase().includes("validation");

  return (
    <div className="w-full border rounded-lg p-4 bg-[#110505]/40 backdrop-blur-md transition-all duration-300 shadow-[0_4px_20px_rgba(239,68,68,0.05)] border-red-950">
      <div className="flex gap-3">
        {isSecurity ? (
          <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
        ) : isRateLimited ? (
          <ZapOff className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        ) : (
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        )}

        <div className="flex-1">
          <h4 className="text-[12px] font-mono font-bold uppercase tracking-wider mb-1 text-red-400">
            {isSecurity 
              ? "Security Guard Triggered" 
              : isRateLimited 
                ? "Rate Limit Boundary Exceeded" 
                : "Database Compilation Exception"
            }
          </h4>
          <p className="text-zinc-300 text-xs leading-relaxed font-sans font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
