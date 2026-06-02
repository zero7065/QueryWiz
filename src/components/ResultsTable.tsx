/**
 * ResultsTable component for QueryWiz
 * Powered by TanStack Table v8 with full sorting, scroll handling,
 * and aesthetic matching to design guidelines.
 */
import React, { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Info, Download } from "lucide-react";

interface ResultsTableProps {
  rows: any[];
  columns: string[];
}

export function ResultsTable({ rows, columns }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Build column definitions dynamically from the SQL headers
  const tableColumns = useMemo(() => {
    if (!columns || columns.length === 0) return [];
    
    return columns.map((colName) => ({
      accessorKey: colName,
      header: colName.replace(/_/g, " ").toUpperCase(),
      cell: (info: any) => {
        const value = info.getValue();
        if (value === null || value === undefined) {
          return <span className="text-zinc-600">-</span>;
        }
        if (typeof value === "boolean") {
          return (
            <span className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${value ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40" : "bg-red-950/40 text-red-400 border border-red-900/40"}`}>
              {value ? "Active" : "Inactive"}
            </span>
          );
        }
        // Format Currency values gracefully (especially Naira for total spent / prices!)
        if (
          colName.toLowerCase().includes("amount") ||
          colName.toLowerCase().includes("price") ||
          colName.toLowerCase().includes("revenue") ||
          colName.toLowerCase().includes("spent")
        ) {
          const num = parseFloat(value);
          if (!isNaN(num)) {
            return (
              <span className="jetbrains text-[#C9A84C]">
                {new Intl.NumberFormat("en-NG", {
                  style: "currency",
                  currency: "NGN",
                  minimumFractionDigits: 2,
                }).format(num)}
              </span>
            );
          }
        }
        // Format raw numbers
        if (typeof value === "number") {
          return <span className="jetbrains">{value.toLocaleString()}</span>;
        }
        
        // Format standard dates
        if (colName.toLowerCase().includes("date") || colName.toLowerCase().includes("date_time") || colName.toLowerCase().includes("at")) {
          try {
            const d = new Date(value);
            if (!isNaN(d.getTime())) {
              return <span className="jetbrains text-zinc-300">{d.toISOString().split("T")[0]}</span>;
            }
          } catch(e) {}
        }

        return <span className="truncate max-w-[240px] block">{String(value)}</span>;
      },
    }));
  }, [columns]);

  // Set up the table instance
  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleExportCSV = () => {
    if (!rows || rows.length === 0 || !columns) return;
    
    // Header row
    const csvHeaders = columns.join(",");
    
    // Data rows
    const csvData = rows.map((row) => {
      return columns.map((col) => {
        let val = row[col];
        if (val === null || val === undefined) {
          return '""';
        }
        let strVal = String(val).replace(/"/g, '""');
        if (strVal.includes(",") || strVal.includes("\n") || strVal.includes('"')) {
          return `"${strVal}"`;
        }
        return strVal;
      }).join(",");
    }).join("\n");
    
    const csvContent = `${csvHeaders}\n${csvData}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `querywiz_results_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!columns || columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gold-border rounded-lg bg-[#111111]/10 text-center p-6">
        <Info className="w-8 h-8 text-zinc-600 mb-2" />
        <span className="text-zinc-400 text-sm font-medium">No database results to render</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] gold-border rounded-lg overflow-hidden shadow-2xl">
      {/* Scrollable Container with Max Height of 400px and custom scroll styling */}
      <div className="flex-grow overflow-auto max-h-[460px]">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-[#151515] gold-text uppercase tracking-tighter text-[10px] select-none sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr 
                key={headerGroup.id} 
                className="border-b border-[#C9A84C22]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="p-3 font-semibold hover:bg-[#202020] transition-colors cursor-pointer relative border-r last:border-r-0 border-[#C9A84C11]"
                  >
                    <div className="flex items-center gap-2">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.column.getIsSorted() ? (
                        header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="w-3 h-3 text-[#C9A84C]" />
                        ) : (
                          <ArrowUp className="w-3 h-3 text-[#C9A84C]" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-zinc-600 hover:text-[#C9A84C]" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="jetbrains divide-y divide-[#C9A84C11] text-zinc-300">
            {rows.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length} 
                  className="p-3 text-center text-zinc-500 italic"
                >
                  (Empty result set returned - zero rows match this query)
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <tr
                  key={row.id}
                  className={`duration-150 ${
                    index % 2 === 0 ? "bg-[#111111]" : "bg-[#0d0d0d]"
                  } hover:bg-[#C9A84C08]`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="p-3 border-r last:border-r-0 border-[#C9A84C05] font-sans font-medium text-xs text-zinc-300"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Actions Bar */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 bg-[#101010] border-t border-[#C9A84C11] text-[10px] font-mono text-zinc-400">
          <div>
            Showing <span className="text-[#C9A84C] font-semibold">{rows.length}</span> results
          </div>
          <button
            type="button"
            id="export-csv-btn"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] uppercase font-mono gold-border rounded opacity-75 hover:opacity-100 bg-[#0d0d0d] text-[#e8e8e8] duration-200 cursor-pointer active:scale-95 transition-all"
          >
            <Download className="w-3 h-3 text-[#C9A84C]" />
            <span>Export CSV</span>
          </button>
        </div>
      )}
    </div>
  );
}
