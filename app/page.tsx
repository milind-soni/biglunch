"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ChevronDown, ChevronRight, Settings } from "lucide-react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataWidget } from "@/components/data-widget";
import Link from "next/link";

export default function Page() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [suggestions, setSuggestions] = useState<{ desktop: string; mobile: string }[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetch("/api/suggestions")
      .then((res) => res.json())
      .then((data) => setSuggestions(data))
      .catch(() => {})
      .finally(() => setSuggestionsLoading(false));
  }, []);

  const isLoading = status === "submitted" || status === "streaming";

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  };

  const handleSuggestion = (q: string) => {
    sendMessage({ text: q });
  };


  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground">biglunch</h1>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            poc
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            DuckDB
          </span>
          <Link href="/connections">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="h-4 w-4" />
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

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center pt-24 text-center space-y-6"
            >
              <div>
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  Ask anything about your data
                </h2>
                <p className="text-muted-foreground">
                  I&apos;ll write SQL, query your database, and give you insights.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestionsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-8 bg-secondary rounded-lg animate-pulse"
                      style={{ width: `${80 + Math.random() * 80}px` }}
                    />
                  ))
                ) : (
                  suggestions.map((q) => (
                    <button
                      key={q.desktop}
                      onClick={() => handleSuggestion(q.desktop)}
                      className="text-sm border border-border text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
                    >
                      <span className="sm:hidden">{q.mobile}</span>
                      <span className="hidden sm:inline">{q.desktop}</span>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[75%]">
                      <p className="text-sm">
                        {message.parts
                          .filter((p) => p.type === "text")
                          .map((p: any) => p.text)
                          .join("")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {message.parts.map((part: any, i: number) => {
                      if (part.type === "text" && part.text) {
                        return (
                          <div
                            key={i}
                            className="prose prose-sm dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-border prose-td:border prose-td:border-border prose-th:px-3 prose-th:py-1.5 prose-td:px-3 prose-td:py-1.5 prose-th:bg-secondary prose-th:text-left prose-th:text-xs prose-th:font-medium prose-th:uppercase"
                          >
                            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(part.text) }} />
                          </div>
                        );
                      }
                      if (part.type === "tool-invocation") {
                        return <ToolCallResult key={part.toolInvocation.toolCallId} part={part} />;
                      }
                      if (part.type.startsWith("tool-")) {
                        return <ToolCallResult key={i} part={part} />;
                      }
                      return null;
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role !== "assistant") && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 shrink-0">
        <form
          id="chat-form"
          onSubmit={handleFormSubmit}
          className="max-w-3xl mx-auto flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your data..."
            className="flex-1 bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="icon"
            disabled={isLoading || !input.trim()}
            className="rounded-xl h-10 w-10 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

function ToolCallResult({ part }: { part: any }) {
  const [expanded, setExpanded] = useState(false);

  const invocation = part.toolInvocation ?? part;
  const isComplete = invocation.state === "result" || invocation.state === "output-available";
  const result = isComplete ? (invocation.result ?? invocation.output) : null;
  const sql = invocation.args?.sql ?? invocation.input?.sql;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      {/* SQL toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-secondary transition-colors cursor-pointer"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? (result?.success ? "bg-emerald-500" : "bg-red-500") : "bg-amber-500 animate-pulse"}`} />
        {isComplete
          ? result?.success
            ? `Query returned ${result.total_rows} row${result.total_rows === 1 ? "" : "s"}`
            : "Query failed"
          : "Running query..."}
        {expanded ? <ChevronDown className="h-3 w-3 ml-auto" /> : <ChevronRight className="h-3 w-3 ml-auto" />}
      </button>

      {/* SQL */}
      {expanded && sql && (
        <div className="border-t border-border px-3 py-2 bg-secondary/50">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{sql}</pre>
        </div>
      )}

      {/* Data widget with table/chart toggle */}
      {isComplete && result?.success && result.rows.length > 0 && (
        <DataWidget
          columns={result.columns}
          rows={result.rows}
          totalRows={result.total_rows}
          visualization={result.visualization}
        />
      )}

      {/* Error */}
      {isComplete && !result?.success && (
        <div className="border-t border-border px-3 py-2 text-xs text-red-500">
          {result?.error}
        </div>
      )}
    </div>
  );
}

function formatMarkdown(text: string): string {
  text = text.replace(
    /\|(.+)\|\n\|[-| :]+\|\n((\|.+\|\n?)+)/g,
    (_, header, body) => {
      const headers = header.split("|").map((h: string) => h.trim()).filter(Boolean);
      const rows = body.trim().split("\n").map((row: string) =>
        row.split("|").map((cell: string) => cell.trim()).filter(Boolean)
      );
      return `<table><thead><tr>${headers.map((h: string) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map((row: string[]) => `<tr>${row.map((cell: string) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    }
  );
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, _l, code) => `<pre class="bg-secondary rounded-md p-3 text-xs overflow-x-auto"><code>${escapeHtml(code.trim())}</code></pre>`);
  text = text.replace(/`([^`]+)`/g, '<code class="bg-secondary px-1 py-0.5 rounded text-xs">$1</code>');
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>');
  text = text.replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-3 mb-1">$1</h2>');
  text = text.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  text = text.replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>');
  text = text.replace(/\n\n/g, "<br/><br/>");
  text = text.replace(/\n/g, "<br/>");
  return text;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
