"use client";

import { useState, useRef } from "react";
import { DynamicChart } from "./dynamic-chart";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Config, Result } from "@/lib/types";
import {
  BarChart3,
  TableIcon,
  Download,
  LineChart,
  PieChart,
  AreaChart,
} from "lucide-react";

interface Visualization {
  type: "bar" | "line" | "area" | "pie";
  xKey: string;
  yKeys: string[];
  title: string;
}

interface DataWidgetProps {
  columns: string[];
  rows: Record<string, any>[];
  totalRows: number;
  visualization?: Visualization | null;
}

function detectVisualization(
  columns: string[],
  rows: Record<string, any>[]
): Visualization | null {
  if (rows.length < 2 || columns.length < 2) return null;

  const numericCols = columns.filter((col) =>
    rows.some((r) => typeof r[col] === "number")
  );
  const stringCols = columns.filter(
    (col) => !numericCols.includes(col)
  );

  if (numericCols.length === 0 || stringCols.length === 0) return null;

  const timeCol = stringCols.find((col) =>
    /date|month|year|time|day|week|period/i.test(col)
  );

  if (timeCol) {
    return {
      type: "line",
      xKey: timeCol,
      yKeys: numericCols.slice(0, 3),
      title: "Trend",
    };
  }

  if (rows.length <= 6 && numericCols.length === 1) {
    return {
      type: "pie",
      xKey: stringCols[0],
      yKeys: [numericCols[0]],
      title: "Distribution",
    };
  }

  return {
    type: "bar",
    xKey: stringCols[0],
    yKeys: numericCols.slice(0, 3),
    title: "Comparison",
  };
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "\u2014";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

function formatColumnTitle(title: string): string {
  return title
    .replace(/^properties__/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function downloadCSV(columns: string[], rows: Record<string, any>[]) {
  const header = columns.join(",");
  const body = rows
    .map((row) =>
      columns
        .map((col) => {
          const val = String(row[col] ?? "");
          return val.includes(",") || val.includes('"')
            ? `"${val.replace(/"/g, '""')}"`
            : val;
        })
        .join(",")
    )
    .join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const chartTypeIcons: Record<string, any> = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  area: AreaChart,
};

export function DataWidget({
  columns,
  rows,
  totalRows,
  visualization,
}: DataWidgetProps) {
  const viz = visualization || detectVisualization(columns, rows);
  const hasChart = viz !== null && rows.length >= 2;

  const [viewMode, setViewMode] = useState<"table" | "chart">(
    hasChart ? "chart" : "table"
  );
  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie">(
    viz?.type ?? "bar"
  );
  const chartRef = useRef<HTMLDivElement>(null);

  const chartConfig: Config | null =
    viz
      ? {
          type: chartType,
          xKey: viz.xKey,
          yKeys: viz.yKeys,
          title: viz.title,
          description: "",
          takeaway: "",
          legend: true,
        }
      : null;

  const chartData: Result[] = rows.map((row) => {
    const result: Result = {};
    for (const [key, value] of Object.entries(row)) {
      result[key] = typeof value === "number" ? value : String(value ?? "");
    }
    return result;
  });

  // Filter columns to hide internal dlt metadata
  const visibleColumns = columns.filter((c) => !c.startsWith("_dlt_"));

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-border bg-secondary/30">
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <button
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
              viewMode === "table"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <TableIcon className="h-3 w-3" />
            Table
          </button>
          {hasChart && (
            <button
              onClick={() => setViewMode("chart")}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors cursor-pointer ${
                viewMode === "chart"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="h-3 w-3" />
              Chart
            </button>
          )}

          {/* Chart type selector */}
          {viewMode === "chart" && hasChart && (
            <div className="flex items-center gap-0.5 ml-2 border-l border-border pl-2">
              {(["bar", "line", "area", "pie"] as const).map((type) => {
                const Icon = chartTypeIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      chartType === type
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    title={type.charAt(0).toUpperCase() + type.slice(1)}
                  >
                    <Icon className="h-3 w-3" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Download */}
        <button
          onClick={() => downloadCSV(visibleColumns, rows)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Download CSV"
        >
          <Download className="h-3 w-3" />
        </button>
      </div>

      {/* Content */}
      {viewMode === "table" ? (
        <div className="max-h-72 overflow-auto border-t border-border">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                {visibleColumns.map((col) => (
                  <TableHead
                    key={col}
                    className="px-3 py-1.5 text-xs font-medium whitespace-nowrap sticky top-0 bg-secondary"
                  >
                    {formatColumnTitle(col)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i}>
                  {visibleColumns.map((col) => (
                    <TableCell
                      key={col}
                      className="px-3 py-1.5 whitespace-nowrap"
                    >
                      {formatValue(row[col])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {totalRows > 100 && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border">
              Showing 100 of {totalRows.toLocaleString()} rows
            </div>
          )}
        </div>
      ) : (
        <div ref={chartRef} className="border-t border-border p-3">
          {chartConfig && chartData.length > 0 ? (
            <DynamicChart chartData={chartData} chartConfig={chartConfig} />
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Not enough data to chart
            </div>
          )}
        </div>
      )}
    </div>
  );
}
