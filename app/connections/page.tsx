"use client";

import { useState, useEffect } from "react";
import Nango from "@nangohq/frontend";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Moon, Sun, Plus, ArrowLeft, Loader2, Check, RefreshCw } from "lucide-react";
import Link from "next/link";

const INTEGRATIONS = [
  { id: "shopify", name: "Shopify", description: "E-commerce orders, products, customers" },
  { id: "hubspot", name: "HubSpot", description: "Contacts, companies, deals" },
  { id: "stripe", name: "Stripe", description: "Payments, charges, subscriptions, invoices" },
  { id: "google-ads", name: "Google Ads", description: "Campaign performance, ad spend" },
  { id: "facebook-ads", name: "Meta Ads", description: "Ad campaigns, adsets, insights" },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<Record<string, { status: string; message: string }>>({});
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    fetchConnections();
  }, []);

  async function fetchConnections() {
    try {
      const res = await fetch("/api/nango/connections");
      const data = await res.json();
      setConnections(data.connections || []);
    } catch {
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    try {
      const res = await fetch("/api/nango/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demo-user", email: "demo@biglunch.com" }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        console.error("Connect session failed:", data);
        alert(`Connection failed: ${data.error || "Unknown error"}`);
        setConnecting(false);
        return;
      }
      const { token } = data;

      const nango = new Nango({ connectSessionToken: token });
      nango.openConnectUI({
        onEvent: (event: any) => {
          if (event.type === "close" || event.type === "connect") {
            fetchConnections();
            setConnecting(false);
          }
        },
      });
    } catch (error) {
      console.error("Failed to open connect UI:", error);
      setConnecting(false);
    }
  }

  async function handleSync(connectionId: string, provider: string) {
    setSyncing(provider);
    setSyncStatus((prev) => ({
      ...prev,
      [provider]: { status: "syncing", message: "Pulling data..." },
    }));
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, provider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncStatus((prev) => ({
          ...prev,
          [provider]: { status: "error", message: data.error || "Sync failed" },
        }));
      } else {
        setSyncStatus((prev) => ({
          ...prev,
          [provider]: { status: "success", message: "Data synced and ready to query" },
        }));
      }
    } catch {
      setSyncStatus((prev) => ({
        ...prev,
        [provider]: { status: "error", message: "Network error" },
      }));
    } finally {
      setSyncing(null);
    }
  }

  function getConnection(integrationId: string) {
    return connections.find(
      (c: any) => c.provider_config_key === integrationId || c.integration_id === integrationId
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleConnect} disabled={connecting} size="sm" variant="outline">
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Add Connection
          </Button>
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
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {/* Data Sources */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-foreground">Data Sources</h2>
              <p className="text-sm text-muted-foreground">
                Connect your accounts to pull data and analyze it with AI
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid gap-3">
                {INTEGRATIONS.map((integration) => {
                  const conn = getConnection(integration.id);
                  const connected = !!conn;
                  const status = syncStatus[integration.id];
                  const isSyncing = syncing === integration.id;

                  return (
                    <div
                      key={integration.id}
                      className="border border-border rounded-lg px-4 py-3 bg-card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {integration.name}
                            </span>
                            {connected && (
                              <span className="flex items-center gap-1 text-xs text-emerald-500">
                                <Check className="h-3 w-3" />
                                Connected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {integration.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {connected && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs"
                              disabled={isSyncing}
                              onClick={() => handleSync(conn.connection_id, integration.id)}
                            >
                              {isSyncing ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-1.5" />
                              )}
                              {isSyncing ? "Syncing..." : "Sync"}
                            </Button>
                          )}
                          {!connected && (
                            <Button variant="outline" size="sm" className="h-8" onClick={handleConnect}>
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Sync status feedback */}
                      {status && (
                        <div
                          className={`mt-2 text-xs px-2 py-1.5 rounded ${
                            status.status === "success"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : status.status === "error"
                                ? "bg-red-500/10 text-red-500"
                                : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {status.status === "syncing" && (
                            <Loader2 className="h-3 w-3 animate-spin inline mr-1.5" />
                          )}
                          {status.message}
                        </div>
                      )}

                      {/* Connection details */}
                      {connected && (
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                            {conn.connection_id}
                          </span>
                          {conn.created_at && (
                            <span>Connected {new Date(conn.created_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Other connections not in INTEGRATIONS list */}
          {connections.filter(
            (c) => !INTEGRATIONS.some(
              (i) => i.id === c.provider_config_key || i.id === c.integration_id
            )
          ).length > 0 && (
            <section>
              <h3 className="text-sm font-medium text-foreground mb-3">Other Connections</h3>
              <div className="grid gap-2">
                {connections
                  .filter(
                    (c) => !INTEGRATIONS.some(
                      (i) => i.id === c.provider_config_key || i.id === c.integration_id
                    )
                  )
                  .map((conn: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between border border-border rounded-lg px-4 py-2.5 bg-card text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        <span className="text-foreground">
                          {conn.provider_config_key || conn.integration_id}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({conn.connection_id})
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {conn.created_at ? new Date(conn.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
