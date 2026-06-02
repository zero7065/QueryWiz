/**
 * Example prompt chips component for QueryWiz
 * Supports dynamic lists edited from the Administrative panel config endpoints.
 */
import React from "react";

interface ExampleChipsProps {
  onSelectChip: (text: string) => void;
  chips?: string[];
}

const DEFAULT_EXAMPLES = [
  "Which Jadai project has the most monthly users?",
  "Total revenue from ExamPadi subscriptions",
  "Show the version and deploy dates of all stable Railway deployments",
  "List tech skills with a proficiency above 8",
  "Which city do most ExamPadi users come from?"
];

export function ExampleChips({ onSelectChip, chips }: ExampleChipsProps) {
  const finalChips = chips && chips.length > 0 ? chips : DEFAULT_EXAMPLES;

  return (
    <div className="w-full flex gap-2 flex-wrap items-center">
      <span className="text-[10px] opacity-45 uppercase tracking-tighter italic mr-2 select-none">
        Try these:
      </span>
      {finalChips.map((example, idx) => (
        <button
          key={idx}
          type="button"
          id={`example-chip-${idx}`}
          onClick={() => onSelectChip(example)}
          className="px-3 py-1 bg-[#111111] gold-border rounded-full text-[11px] text-[#e8e8e8]/80 hover:text-white opacity-70 hover:opacity-100 cursor-pointer transition-all duration-200 active:scale-[0.98] font-sans hover:border-[#C9A84C44]"
        >
          "{example}"
        </button>
      ))}
    </div>
  );
}
