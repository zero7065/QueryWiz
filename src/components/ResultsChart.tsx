/**
 * Upgraded ResultsChart component for QueryWiz
 * Powered by Recharts. Features:
 * - Multi-column support: handles any number of columns.
 * - Auto-detects numeric columns (Y-axis options) and non-numeric/date columns (X-axis options).
 * - Enables custom X-axis and Y-axis selection using dropdown menus if multiple options exist.
 * - Auto-detects date columns and defaults to a Line Chart for time-series data.
 * - Beautiful color palettes and rename-able axis labels.
 * - High-resolution client-side PNG and vector SVG downloads.
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
import { BarChart3, Palette, Download, Check, Edit2, Play, Calendar } from "lucide-react";

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
  const [selectedX, setSelectedX] = useState<string>("");
  const [selectedY, setSelectedY] = useState<string>("");

  // Custom AXIS names overrides
  const [xAxisLabel, setXAxisLabel] = useState("");
  const [yAxisLabel, setYAxisLabel] = useState("");

  const [isEditingX, setIsEditingX] = useState(false);
  const [isEditingY, setIsEditingY] = useState(false);

  // Scan database rows and columns to find suitability profiles
  const { numericCols, stringOrDateCols, dateCols } = useMemo(() => {
    if (!columns || columns.length === 0 || !rows || rows.length === 0) {
      return { numericCols: [], stringOrDateCols: [], dateCols: [] };
    }

    const firstRow = rows[0];
    const nCols: string[] = [];
    const sCols: string[] = [];
    const dCols: string[] = [];

    columns.forEach((col) => {
      const val = firstRow[col];
      const valType = typeof val;

      // Determine if column is predominantly numeric
      const isColNumeric = rows.every(r => r[col] === null || r[col] === undefined || !isNaN(Number(r[col])));
      
      if (valType === "number" || (isColNumeric && val !== null && val !== undefined && val !== "")) {
        nCols.push(col);
      } else {
        sCols.push(col);
      }

      // Check if it looks like a date/timestamp
      const nameLower = col.toLowerCase();
      const isDateName = nameLower.includes("date") || nameLower.includes("at") || nameLower.includes("occurred") || nameLower.includes("time");
      if (isDateName || (val && typeof val === "string" && val.includes("-") && !isNaN(Date.parse(val)))) {
        dCols.push(col);
      }
    });

    // Fallback if no numeric columns found, treat everything as string
    if (nCols.length === 0 && columns.length > 0) {
      // Just put the second column as numeric or anything if present
      if (columns.length > 1) {
        nCols.push(columns[1]);
        sCols.push(columns[0]);
      } else {
        nCols.push(columns[0]);
      }
    }

    return {
      numericCols: nCols,
      stringOrDateCols: sCols.length > 0 ? sCols : columns,
      dateCols: dCols
    };
  }, [rows, columns]);

  // Set default axes on load or reset
  useEffect(() => {
    if (columns && columns.length > 0) {
      // 1. Locate default Y channel
      const defaultY = numericCols[0] || columns[1] || columns[0];
      setSelectedY(defaultY);
      setYAxisLabel(defaultY.replace(/_/g, " ").toUpperCase());

      // 2. Locate default X channel
      let defaultX = "";
      if (dateCols.length > 0) {
        defaultX = dateCols[0];
        setChartType("line"); // Default to Line Chart for time-series!
      } else if (stringOrDateCols.length > 0) {
        // Prefer a column that isn't the selected Y
        const nonYStrings = stringOrDateCols.filter(col => col !== defaultY);
        defaultX = nonYStrings[0] || stringOrDateCols[0];
      } else {
        defaultX = columns[0];
      }
      setSelectedX(defaultX);
      setXAxisLabel(defaultX.replace(/_/g, " ").toUpperCase());
    }
  }, [rows, columns, numericCols, stringOrDateCols, dateCols]);

  // Dynamic values mapper
  const chartData = useMemo(() => {
    if (!selectedX || !selectedY || !rows || rows.length === 0) return [];

    return rows.map((r) => {
      const xVal = r[selectedX];
      let xStr = String(xVal ?? "-");

      // Format ISO string slices
      if (xStr.includes("T") && !isNaN(Date.parse(xStr))) {
        xStr = xStr.split("T")[0];
      }
      if (xStr.length > 25) {
        xStr = xStr.substring(0, 22) + "...";
      }

      const yVal = parseFloat(r[selectedY]);

      return {
        name: xStr,
        value: isNaN(yVal) ? 0 : yVal,
        rawName: r[selectedX],
      };
    });
  }, [rows, selectedX, selectedY]);

  // If there's missing configuration profile, render placeholder
  if (!rows || rows.length === 0 || !selectedX || !selectedY) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 gold-border bg-[#111111]/10 rounded-lg text-center h-[340px]">
        <BarChart3 className="w-10 h-10 text-zinc-700 mb-3 animate-pulse" />
        <h4 className="text-[#C9A84C] text-[13px] font-mono tracking-wide uppercase font-bold mb-1">
          Bar Chart Unmapped
        </h4>
        <p className="text-zinc-500 text-xs max-w-sm leading-relaxed font-sans">
          The chart view dynamically triggers when the SQL output contains records. Select standard items to render visualizations.
        </p>
      </div>
    );
  }

  // Is currency check
  const isCurrency = selectedY.toLowerCase().includes("amount") || 
                     selectedY.toLowerCase().includes("price") || 
                     selectedY.toLowerCase().includes("revenue") ||
                     selectedY.toLowerCase().includes("spent");

  // Custom tooltips
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

  /**
   * Export SVG graphics
   */
  const handleExportSvg = () => {
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

    // Embed backgrounds for pristine vector rendering
    const isLight = document.documentElement.classList.contains("light");
    source = source.replace(/^<svg/, `<svg style="background-color: ${isLight ? "#f5f2e8" : "#0d0d0d"}; font-family: 'JetBrains Mono', monospace;"`);

    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `querywiz_chart_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Export PNG high-quality raster imagery
   */
  const handleExportPng = () => {
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

    const isLight = document.documentElement.classList.contains("light");
    
    // Create image and draw to canvas with beautiful custom background fills
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = svgEl.clientWidth || 600;
    const height = svgEl.clientHeight || 300;
    
    canvas.width = width * 2; // high definition scale mapping
    canvas.height = height * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = isLight ? "#f5f2e8" : "#0d0d0d";
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      const pngUrl = canvas.toDataURL("image/png");
      
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `querywiz_chart_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    img.src = url;
  };

  return (
    <div className="bg-[#0d0d0d] gold-border rounded-lg p-5 flex flex-col h-full min-h-[440px] shadow-2xl gap-4">
      {/* Dynamic Dropdowns & Controls Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#C9A84C11] pb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#C9A84C] uppercase tracking-wider font-semibold select-none">
          <BarChart3 className="w-4 h-4 text-[#C9A84C]" />
          <span>Interactive Visualizer</span>
        </div>

        {/* AXES DROPDOWN CUSTOMIZERS (MULTI-COLUMN CAPABILITIES) */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* X Axis Selector */}
          <div className="flex items-center gap-1 bg-[#111111]/80 px-2 py-1 rounded gold-border text-[10px] font-mono leading-none">
            <span className="text-zinc-500 uppercase">X:</span>
            <select
              value={selectedX}
              onChange={(e) => {
                setSelectedX(e.target.value);
                setXAxisLabel(e.target.value.replace(/_/g, " ").toUpperCase());
              }}
              className="bg-transparent text-zinc-300 font-bold outline-none border-none py-0.5 cursor-pointer max-w-[100px]"
            >
              {columns.map(col => (
                <option key={col} value={col} className="bg-[#111] text-zinc-300">
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Y Axis Selector */}
          <div className="flex items-center gap-1 bg-[#111111]/80 px-2 py-1 rounded gold-border text-[10px] font-mono leading-none">
            <span className="text-zinc-500 uppercase">Y:</span>
            <select
              value={selectedY}
              onChange={(e) => {
                setSelectedY(e.target.value);
                setYAxisLabel(e.target.value.replace(/_/g, " ").toUpperCase());
              }}
              className="bg-transparent text-[#C9A84C] font-bold outline-none border-none py-0.5 cursor-pointer max-w-[100px]"
            >
              {numericCols.map(col => (
                <option key={col} value={col} className="bg-[#111] text-[#C9A84C]">
                  {col}
                </option>
              ))}
              {/* Fallback to show all in dropdown if numeric is none */}
              {numericCols.length === 0 && columns.map(col => (
                <option key={col} value={col} className="bg-[#111] text-[#C9A84C]">
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Type */}
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

          {/* Color Palette Toggle */}
          <div className="flex items-center gap-1 bg-[#111]/8o px-2 py-1 rounded gold-border">
            <Palette className="w-3 h-3 text-[#C9A84C] opacity-65" />
            <div className="flex items-center gap-1">
              {PALETTE.map((p) => (
                <button
                  key={p.hex}
                  onClick={() => setSelectedColor(p.hex)}
                  title={p.name}
                  className="w-3 h-3 rounded-full cursor-pointer transition-all relative border border-white/10"
                  style={{ backgroundColor: p.hex }}
                >
                  {selectedColor === p.hex && (
                    <span className="absolute inset-x-0 -top-0.5 flex items-center justify-center text-[7px] text-white font-extrabold">&bull;</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Export action shelf */}
          <div className="flex items-center gap-1 bg-[#111] p-0.5 rounded gold-border">
            <button
              onClick={handleExportSvg}
              className="px-2 py-1 text-[9px] uppercase font-mono rounded hover:bg-[#222] text-zinc-300 duration-100 cursor-pointer flex items-center gap-0.5"
              title="Download vector SVG"
            >
              <Download className="w-2.5 h-2.5 text-zinc-500" />
              <span>SVG</span>
            </button>
            <div className="h-3 w-px bg-zinc-800" />
            <button
              onClick={handleExportPng}
              className="px-2 py-1 text-[9px] uppercase font-mono rounded hover:bg-[#222] text-[#C9A84C] font-bold duration-100 cursor-pointer flex items-center gap-0.5"
              title="Download PNG image"
            >
              <Download className="w-2.5 h-2.5 text-[#C9A84C]" />
              <span>PNG</span>
            </button>
          </div>

        </div>
      </div>

      {/* Axis Labels Inline Renamer */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-[#111111]/40 gold-border rounded px-3 py-2 text-[10px] font-mono leading-none">
        {/* X Label renaming */}
        <div className="flex items-center gap-1.5 flex-1 select-none">
          <span className="text-zinc-500 uppercase">X-Axis Label:</span>
          {isEditingX ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={xAxisLabel}
                onChange={(e) => setXAxisLabel(e.target.value)}
                onBlur={() => setIsEditingX(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingX(false)}
                className="bg-[#000] border border-[#C9A84C44] px-1.5 py-0.5 rounded text-white text-[10px] max-w-[150px] outline-none font-mono"
                autoFocus
              />
              <Check className="w-3 h-3 text-emerald-400 cursor-pointer" onClick={() => setIsEditingX(false)} />
            </div>
          ) : (
            <div className="flex items-center gap-1 hover:text-[#C9A84C] cursor-pointer group" onClick={() => setIsEditingX(true)}>
              <span className="font-semibold text-zinc-350">{xAxisLabel}</span>
              <Edit2 className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>

        {/* Y Label renaming */}
        <div className="flex items-center gap-1.5 flex-1 select-none">
          <span className="text-zinc-500 uppercase">Y-Axis Label:</span>
          {isEditingY ? (
            <div className="flex items-center gap-1 flex-1">
              <input
                type="text"
                value={yAxisLabel}
                onChange={(e) => setYAxisLabel(e.target.value)}
                onBlur={() => setIsEditingY(false)}
                onKeyDown={(e) => e.key === "Enter" && setIsEditingY(false)}
                className="bg-[#000] border border-[#C9A84C44] px-1.5 py-0.5 rounded text-white text-[10px] max-w-[150px] outline-none font-mono"
                autoFocus
              />
              <Check className="w-3 h-3 text-emerald-400 cursor-pointer" onClick={() => setIsEditingY(false)} />
            </div>
          ) : (
            <div className="flex items-center gap-1 hover:text-[#C9A84C] cursor-pointer group" onClick={() => setIsEditingY(true)}>
              <span className="font-semibold text-zinc-350">{yAxisLabel}</span>
              <Edit2 className="w-2.5 h-2.5 text-zinc-600 opacity-0 group-hover:opacity-100" />
            </div>
          )}
        </div>
      </div>

      {/* Primary Chart Area Frame */}
      <div id="querywiz-chart-container" className="flex-grow w-full h-[280px] relative mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
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
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="chartGradientUpgraded" x1="0" y1="0" x2="0" y2="1">
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
              <Area type="monotone" dataKey="value" stroke={selectedColor} fillOpacity={1} fill="url(#chartGradientUpgraded)" strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
