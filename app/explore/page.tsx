"use client";

import { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Moon,
  Sun,
  Loader2,
  ChevronDown,
  ChevronRight,
  Database,
  Table2,
  Eye,
  Pencil,
  Check,
  X,
  MessageSquare,
} from "lucide-react";

interface Column {
  name: string;
  type: string;
}

interface TableInfo {
  name: string;
  type: "table" | "view";
  rowCount: number;
  columns: Column[];
  sampleRows: Record<string, unknown>[];
}

type Annotations = Record<string, { description?: string; columns?: Record<string, string> }>;

export default function ExplorePage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [annotations, setAnnotations] = useState<Annotations>({});
  const [loading, setLoading] = useState(true);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [showSamples, setShowSamples] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchData = useCallback(async () => {
    try {
      const [schemaRes, annotRes] = await Promise.all([
        fetch("/api/schema"),
        fetch("/api/annotations"),
      ]);
      const schemaData = await schemaRes.json();
      const annotData = await annotRes.json();
      setTables(schemaData);
      setAnnotations(annotData);
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveAnnotation(body: Record<string, string | undefined>) {
    const res = await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) setAnnotations(data);
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Explore</h1>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {tables.length} table{tables.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <MessageSquare className="h-3 w-3" />
              Chat
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {mounted ? (theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />) : <Sun className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-24 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No tables found</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Add descriptions to help the AI understand your data better.
                These annotations are included in every chat prompt.
              </p>
              {tables.map((table) => (
                <TableCard
                  key={table.name}
                  table={table}
                  annotation={annotations[table.name]}
                  expanded={expandedTable === table.name}
                  showingSamples={showSamples === table.name}
                  onToggle={() => setExpandedTable(expandedTable === table.name ? null : table.name)}
                  onToggleSamples={() => setShowSamples(showSamples === table.name ? null : table.name)}
                  onSave={saveAnnotation}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TableCard({
  table,
  annotation,
  expanded,
  showingSamples,
  onToggle,
  onToggleSamples,
  onSave,
}: {
  table: TableInfo;
  annotation?: { description?: string; columns?: Record<string, string> };
  expanded: boolean;
  showingSamples: boolean;
  onToggle: () => void;
  onToggleSamples: () => void;
  onSave: (body: Record<string, string | undefined>) => Promise<void>;
}) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Table header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        {table.type === "view" ? (
          <Eye className="h-4 w-4 text-blue-500 shrink-0" />
        ) : (
          <Table2 className="h-4 w-4 text-emerald-500 shrink-0" />
        )}
        <span className="text-sm font-medium text-foreground">{table.name}</span>
        <span className="text-xs text-muted-foreground">
          {table.type} · {table.columns.length} col{table.columns.length !== 1 ? "s" : ""} · {Number(table.rowCount).toLocaleString()} row{table.rowCount !== 1 ? "s" : ""}
        </span>
        {annotation?.description && (
          <span className="text-xs text-muted-foreground ml-auto mr-2 truncate max-w-[200px]">
            {annotation.description}
          </span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-border">
          {/* Table description */}
          <div className="px-4 py-2 border-b border-border bg-secondary/30">
            <EditableField
              label="Table description"
              value={annotation?.description || ""}
              placeholder="e.g. E-commerce transactions from Shopify"
              onSave={(value) => onSave({ table: table.name, description: value })}
            />
          </div>

          {/* Columns */}
          <div className="divide-y divide-border">
            {table.columns.map((col) => (
              <div key={col.name} className="px-4 py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-foreground">{col.name}</code>
                    <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                      {col.type}
                    </span>
                  </div>
                  <EditableField
                    value={annotation?.columns?.[col.name] || ""}
                    placeholder="Add description..."
                    onSave={(value) =>
                      onSave({ table: table.name, column: col.name, columnDescription: value })
                    }
                    compact
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Sample data toggle */}
          <div className="border-t border-border">
            <button
              onClick={onToggleSamples}
              className="w-full px-4 py-2 text-xs text-muted-foreground hover:bg-secondary/50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {showingSamples ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Sample data ({Math.min(3, table.sampleRows.length)} rows)
            </button>
            {showingSamples && table.sampleRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary">
                      {table.columns.map((col) => (
                        <th key={col.name} className="px-3 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.sampleRows.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        {table.columns.map((col) => (
                          <td key={col.name} className="px-3 py-1.5 text-foreground whitespace-nowrap max-w-[200px] truncate">
                            {formatValue(row[col.name])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  placeholder,
  onSave,
  compact,
}: {
  label?: string;
  value: string;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={`flex items-center gap-2 ${compact ? "mt-1" : ""}`}>
        {label && <span className="text-xs text-muted-foreground shrink-0">{label}:</span>}
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          placeholder={placeholder}
          className={`flex-1 bg-background border border-border rounded px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring ${compact ? "text-xs" : "text-sm"}`}
          disabled={saving}
        />
        <button onClick={handleSave} disabled={saving} className="text-emerald-500 hover:text-emerald-400 cursor-pointer">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        </button>
        <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 group ${compact ? "mt-1" : ""}`}>
      {label && <span className="text-xs text-muted-foreground shrink-0">{label}:</span>}
      {value ? (
        <span className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>{value}</span>
      ) : (
        <span className={`text-muted-foreground/50 italic ${compact ? "text-xs" : "text-sm"}`}>{placeholder}</span>
      )}
      <button
        onClick={() => { setDraft(value); setEditing(true); }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity cursor-pointer"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
