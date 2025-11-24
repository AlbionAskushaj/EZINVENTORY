import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type BreakdownItem = {
  name: string;
  category: string;
  modifier?: string;
  avgPrice?: number;
  quantity: number;
  netSales?: number;
  hasRecipe: boolean;
  isBeverage: boolean;
};

type BreakdownSummary = {
  totalItems: number;
  missingRecipeCount: number;
  totalNetSales: number;
  totalQuantity: number;
  periodStart?: string;
  periodEnd?: string;
};

export default function MenuBreakdownPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const apiBase = import.meta.env.VITE_API_URL;

  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [summary, setSummary] = useState<BreakdownSummary | null>(null);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setItems([]);
    setSummary(null);
    setError("");
    setSelectedFile(null);
  }, [token]);

  async function handleUpload() {
    if (!selectedFile || !token) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch(`${apiBase}/api/menu-breakdown/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const payload = await res.json();
      setItems(payload.items || []);
      setSummary(payload.summary || null);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const beverages = useMemo(
    () => items.filter((i) => i.isBeverage),
    [items]
  );
  const foods = useMemo(
    () => items.filter((i) => !i.isBeverage),
    [items]
  );

  function addToMenu(name: string) {
    try {
      sessionStorage.setItem("ezinv.menu.prefill", name);
    } catch {
      // ignore storage issues
    }
    navigate("/menu");
  }

  return (
    <div>
      <h1>Menu Breakdown</h1>
      <p>
        Drop the latest “menu breakdown” export. We’ll parse items, flag which
        already have recipes, and surface beverages separately. Missing recipes
        get an “add to menu” shortcut so you can wire them for advanced metrics.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) {
            setSelectedFile(e.dataTransfer.files[0]);
          }
        }}
        style={{
          border: "2px dashed #666",
          borderColor: dragging ? "#7c5cff" : "#666",
          padding: "32px 16px",
          textAlign: "center",
          background: dragging ? "rgba(124,92,255,0.08)" : "transparent",
          marginBottom: 14,
        }}
      >
        <p style={{ margin: 0 }}>
          {selectedFile
            ? selectedFile.name
            : "Drag a menu breakdown CSV here or click to browse"}
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            if (e.target.files?.length) setSelectedFile(e.target.files[0]);
          }}
          style={{ marginTop: 10 }}
        />
      </div>

      <button
        type="button"
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
      >
        {uploading ? "Processing…" : "Upload & analyze"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: 10 }}>
          <strong>Error:</strong> {error}
        </p>
      )}

      {summary && (
        <div
          className="card"
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <Metric
            label="Items parsed"
            value={summary.totalItems.toString()}
            hint={
              summary.periodStart && summary.periodEnd
                ? `${new Date(summary.periodStart).toLocaleDateString()} → ${new Date(
                    summary.periodEnd
                  ).toLocaleDateString()}`
                : undefined
            }
          />
          <Metric
            label="Missing recipes"
            value={summary.missingRecipeCount.toString()}
            hint="Add these to unlock expected inventory"
          />
          <Metric
            label="Total net sales"
            value={
              summary.totalNetSales
                ? `$${summary.totalNetSales.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}`
                : "—"
            }
            hint="From file"
          />
          <Metric
            label="Qty sold"
            value={summary.totalQuantity.toLocaleString()}
            hint="Across all rows"
          />
        </div>
      )}

      {foods.length > 0 && (
        <Section
          title="Food items"
          subtitle="Items we expect to have recipes for"
          rows={foods}
          onAdd={addToMenu}
        />
      )}

      {beverages.length > 0 && (
        <Section
          title="Beverages"
          subtitle="Drinks, beer, wine, cocktails — track separately"
          rows={beverages}
          onAdd={addToMenu}
        />
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  rows,
  onAdd,
}: {
  title: string;
  subtitle?: string;
  rows: BreakdownItem[];
  onAdd: (name: string) => void;
}) {
  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>{title}</h2>
          {subtitle && (
            <p style={{ color: "var(--muted)", margin: 0 }}>{subtitle}</p>
          )}
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Qty</th>
            <th>Net Sales</th>
            <th>Recipe status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={`${item.name}-${item.category}`}>
              <td>{item.modifier ? `${item.name} (${item.modifier})` : item.name}</td>
              <td>{item.category || "Uncategorized"}</td>
              <td>{item.quantity.toLocaleString()}</td>
              <td>
                {item.netSales
                  ? `$${item.netSales.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}`
                  : "—"}
              </td>
              <td>
                {item.hasRecipe ? (
                  <span style={{ color: "#4ade80" }}>Has recipe</span>
                ) : (
                  <span style={{ color: "#ff7b9c" }}>
                    Add this to the menu for advanced metrics
                  </span>
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {!item.hasRecipe && (
                  <button type="button" onClick={() => onAdd(item.name)}>
                    Add to menu
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
      <p style={{ color: "var(--muted)", marginBottom: 4 }}>{label}</p>
      <h2 style={{ margin: 0 }}>{value}</h2>
      {hint && (
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
