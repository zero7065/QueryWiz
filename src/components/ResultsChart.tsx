/**
 * ResultsChart component for QueryWiz
 * Powered by Recharts. Offers dynamic dataset scanning:
 * - Fits Bar, Line, and Area layouts.
 * - Dynamic color customizers: Gold, Green, Blue, Pink, Orange, Purple.
 * - Inline axis label renamers.
 * - Auto-export vector graphics helper.
 */
import React, { useMemo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, Palette, LayoutGrid, Download, Check, Edit2 } from "lucide-react";

interface ResultsChartProps {
  rows: any[];
  columns: string[];
}

const PALETTE = [
  { name: "Gold", hex: "#C9A84C" },
  { name: "Green", hex: "#4CAF50" },
  { name: "Blue", hex: "#2196F3" },
  { name: "Pink", hex: "#E91E63" },
  { name: "Orange", hex: "#FF5722" },
  { name: "Purple", hex: "#9C27B0" }
];

export function ResultsChart({ rows, columns }: ResultsChartProps) {
  const [chartType, setChartType] = useState<"bar" | "line" | "area">("bar");
  const [selectedColor, setSelectedColor] = useState("#C9A84C");
  
  // Custom axis names
  const [xAxisLabel, setXAxisLabel] = useState("");
  const [yAxisLabel, setYAxisLabel] = useState("");
  
  const [isEditingX, setIsEditingX] = useState(false);
  const [isEditingY, setIsEditingY] = useState(false);

  // Scans row elements to check if we have exactly 2 columns (one label, one numeric)
  const chartConfig = useMemo(() => {
    if (!columns || columns.length !== 2 || !rows || rows.length === 0) {
      return null;
    }

    const firstRow = rows[0];
    const keys = Object.keys(firstRow);
    if (keys.length !== 2) return null;

    let labelKey = "";
    let valueKey = "";

    const type0 = typeof firstRow[keys[0]];
    const type1 = typeof firstRow[keys[1]];

    if (type0 === "number" && type1 !== "number") {
      valueKey = keys[0];
      labelKey = keys[1];
    } else if (type1 === "number" && type0 !== "number") {
      valueKey = keys[1];
      labelKey = keys[0];
    } else if (type0 === "number" && type1 === "number") {
      labelKey = keys[0];
      valueKey = keys[1];
    } else {
      return null;
    }

    const data = rows.map((r) => {
      const labelVal = r[labelKey];
      let labelStr = String(labelVal ?? "-");
      
      if (labelStr.includes("T") && !isNaN(Date.parse(labelStr))) {
        labelStr = labelStr.split("T")[0];
      }

      if (labelStr.length > 18) {
        labelStr = labelStr.substring(0, 15) + "...";
      }

      return {
        name: labelStr,
        value: parseFloat(r[valueKey]) || 0,
        rawName: r[labelKey],
      };
    });

    return {
      data,
      labelName: labelKey.replace(/_/g, " ").toUpperCase(),
      valueName: valueKey.replace(/_/g, " ").toUpperCase(),
      isCurrency: valueKey.toLowerCase().includes("amount") || 
                  valueKey.toLowerCase().includes("price") || 
                  valueKey.toLowerCase().includes("revenue") ||
                  valueKey.toLowerCase().includes("spent"),
    };
  }, [rows, columns]);

  // Sync state when chart config recalculates
  useEffect(() => {
    if (chartConfig) {
      setXAxisLabel(chartConfig.labelName);
      setYAxisLabel(chartConfig.valueName);
    }
  }, [chartConfig]);

  if (!chartConfig) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 gold-border bg-[#111111]/10 rounded-lg text-center h-[340px]">
        <BarChart3 className="w-10 h-10 text-zinc-700 mb-3" />
        <h4 className="text-[#C9A84C] text-[13px] font-mono tracking-wide uppercase font-bold mb-1">
          Bar Chart Unmapped
        </h4>
        <p className="text-zinc-500 text-xs max-w-sm leading-relaxed">
          The chart view dynamically triggers when the SQL output has exactly **2 columns** (e.g. 1 label and 1 numeric series). Choose an aggregate query above, or click on sub-queries showing metrics!
        </p>
      </div>
    );
  }

  const { data, isCurrency } = chartConfig;

  // Custom tooltips with dark background and gold border matching guidelines
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-[#0f0f0f] border border-[#C9A84C44] rounded p-3 shadow-xl backdrop-blur-md text-[11px] font-mono">
          <p className="text-zinc-400 mb-1">{xAxisLabel}: <span className="text-[#e8e8e8] font-bold">{dataPoint.rawName}</span></p>
          <p className="text-[#C9A84C] font-extrabold flex items-center gap-1">
            <span>{yAxisLabel}:</span>
            <span>
              {isCurrency
                ? new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                    minimumFractionDigits: 2,
                  }).format(dataPoint.value)
                : dataPoint.value.toLocaleString()}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const handleExportChart = () => {
    const container = document.getElementById("querywiz-chart-container");
    const svgEl = container?.querySelector("svg");
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);

    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
      source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    // Embed strict styles for downloads
    source = source.replace(/^<svg/, `<svg style="background-color: #0d0d0d; font-family: 'JetBrains Mono', monospace;"`);

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `querywiz_chart_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#0d0d0d] gold-border rounded-lg p-5 flex flex-col h-full min-h-[420px] shadow-2xl gap-4">
      {/* Configuration Header Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#C9A84C11] pb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#C9A84C] uppercase tracking-wider font-semibold">
          <BarChart3 className="w-4 h-4 text-[#C9A84C]" />
          <span>Interactive Visualizer</span>
        </div>

        {/* CONTROLLER SHELF */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Layout switches */}
          <div className="flex bg-[#111] gold-border rounded p-0.5 text-[10px] font-mono leading-none">
            {(["bar", "line", "area"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-2 py-1 rounded cursor-pointer duration-100 uppercase font-bold text-[9px] ${
                  chartType === type 
                    ? "bg-[#C9A84C] text-[#0a0a0a]" 
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Color Palletes */}
          <div className="flex items-center gap-1.5 bg-[#111]/80 px-2 py-1 rounded gold-border">
            <Palette className="w-3 h-3 text-[#C9A84C] opacity-60" />
            <div className="flex items-center gap-1">
              {PALETTE.map((p) => (
                <button
                  key={p.hex}
                  onClick={() => setSelectedColor(p.hex)}
                  title={p.name}
                  className="w-3.5 h-3.5 rounded-full cursor-pointer transition-all relative border border-white/10"
                  style={{ backgroundColor: p.hex }}
                >
                  {selectedColor === p.hex && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-extrabold">&bull;</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Export utility */}
          <button
            onClick={handleExportChart}
            className="flex items-center gap-1 px-2.5 py-1 text-[9px] uppercase font-mono gold-border rounded opacity-75 hover:opacity-100 bg-[#111111] text-[#e8e8e8] duration-150 cursor-pointer"
            title="Download vector graphic"
          >
            <Download className="w-2.5 h-2.5 text-[#C9A84C]" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* RENAMEABLE AXIS CONTROL FIELDS */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-[#111111]/40 gold-border rounded px-3 py-2 text-[10px] font-mono">
        {/* X Axis Label */}
        <div className="flex items-center gap-1.5 flex-1 select-none">
          <span className="text-zinc-500 uppercase">X Label:</span>
          {isEditingX ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={xAxisLabel}
                onChange={(e) => setXAxisLabel(e.target.value)}
                onBlur={() => setIsEditingX(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingX(false)}
                className="bg-[#000] border border-[#C9A84C44] px-1.5 py-0.5 rounded text-white text-[10.5px] max-w-[150px] outline-none"
                autoFocus
              />
              <Check className="w-3 h-3 text-emerald-400 cursor-pointer" onClick={() => setIsEditingX(false)} />
            </div>
          ) : (
            <div className="flex items-center gap-1 hover:text-[#C9A84C] cursor-pointer group" onClick={() => setIsEditingX(true)}>
              <span className="font-semibold text-zinc-300">{xAxisLabel}</span>
              <Edit2 className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>

        {/* Y Axis Label */}
        <div className="flex items-center gap-1.5 flex-1 select-none">
          <span className="text-zinc-500 uppercase">Y Label:</span>
          {isEditingY ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={yAxisLabel}
                onChange={(e) => setYAxisLabel(e.target.value)}
                onBlur={() => setIsEditingY(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingY(false)}
                className="bg-[#000] border border-[#C9A84C44] px-1.5 py-0.5 rounded text-white text-[10.5px] max-w-[150px] outline-none"
                autoFocus
              />
              <Check className="w-3 h-3 text-emerald-400 cursor-pointer" onClick={() => setIsEditingY(false)} />
            </div>
          ) : (
            <div className="flex items-center gap-1 hover:text-[#C9A84C] cursor-pointer group" onClick={() => setIsEditingY(true)}>
              <span className="font-semibold text-zinc-300">{yAxisLabel}</span>
              <Edit2 className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>
      </div>

      {/* PRIMARY REALTIME CONTAINER */}
      <div id="querywiz-chart-container" className="flex-grow w-full h-[280px] relative">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#C9A84C11" vertical={false} />
              <XAxis dataKey="name" stroke="#666666" fontSize={10} tickLine={false} axisLine={{ stroke: "#C9A84C22" }} />
              <YAxis
                stroke="#666666"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#C9A84C22" }}
                tickFormatter={(val) => {
                  if (isCurrency) {
                    if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`;
                    if (val >= 1e3) return `₦${(val / 1e3).toFixed(0)}k`;
                    return `₦${val}`;
                  }
                  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}k`;
                  return val;
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(201,168,76,0.03)" }} />
              <Bar dataKey="value" fill={selectedColor} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#C9A84C11" vertical={false} />
              <XAxis dataKey="name" stroke="#666666" fontSize={10} tickLine={false} axisLine={{ stroke: "#C9A84C22" }} />
              <YAxis
                stroke="#666666"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#C9A84C22" }}
                tickFormatter={(val) => {
                  if (isCurrency) {
                    if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`;
                    if (val >= 1e3) return `₦${(val / 1e3).toFixed(0)}k`;
                    return `₦${val}`;
                  }
                  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}k`;
                  return val;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="value" stroke={selectedColor} strokeWidth={2.5} activeDot={{ r: 6 }} dot={{ strokeWidth: 1 }} />
            </LineChart>
          ) : (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={selectedColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={selectedColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#C9A84C11" vertical={false} />
              <XAxis dataKey="name" stroke="#666666" fontSize={10} tickLine={false} axisLine={{ stroke: "#C9A84C22" }} />
              <YAxis
                stroke="#666666"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: "#C9A84C22" }}
                tickFormatter={(val) => {
                  if (isCurrency) {
                    if (val >= 1e6) return `₦${(val / 1e6).toFixed(1)}M`;
                    if (val >= 1e3) return `₦${(val / 1e3).toFixed(0)}k`;
                    return `₦${val}`;
                  }
                  if (val >= 1e3) return `${(val / 1e3).toFixed(0)}k`;
                  return val;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="value" stroke={selectedColor} fillOpacity={1} fill="url(#chartGradient)" strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
