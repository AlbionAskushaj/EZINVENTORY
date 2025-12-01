import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

type ApiBreakdownItem = {
  name: string;
  category: string;
  modifier?: string;
  avgPrice?: number;
  quantity: number;
  netSales?: number;
  hasRecipe: boolean;
  isBeverage: boolean | null;
};

type BreakdownItem = ApiBreakdownItem & { id: string };
type UploadSummary = {
  id: string;
  originalName: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
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

  const foodDrinkCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topItemsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [items, setItems] = useState<BreakdownItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentUploadId, setCurrentUploadId] = useState<string | null>(null);
  const [currentUploadName, setCurrentUploadName] = useState<string>("");
  const [uploads, setUploads] = useState<UploadSummary[]>([]);
  const [summary, setSummary] = useState<BreakdownSummary | null>(null);
  const [error, setError] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setItems([]);
    setSelectedIds(new Set());
    setSummary(null);
    setError("");
    setSelectedFile(null);
    setCurrentUploadId(null);
    setCurrentUploadName("");
    loadUploads();
  }, [token]);

  async function loadUploads() {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/api/menu-breakdown/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const body = await res.json();
      const mapped: UploadSummary[] = (body.uploads || []).map((u: any) => ({
        id: u._id,
        originalName: u.originalName,
        periodStart: u.periodStart,
        periodEnd: u.periodEnd,
        createdAt: u.createdAt,
      }));
      setUploads(mapped);
    } catch {
      setUploads([]);
    }
  }

  function sortItems(rawItems: ApiBreakdownItem[]) {
    const keyed: BreakdownItem[] = rawItems.map((item, index) => ({
      ...item,
      id: `${item.name}-${item.category}-${item.modifier ?? "base"}-${index}`,
    }));
    return keyed.sort((a, b) => b.quantity - a.quantity);
  }

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
      const rawItems: ApiBreakdownItem[] = Array.isArray(payload.items)
        ? payload.items
        : [];
      setItems(sortItems(rawItems));
      setSelectedIds(new Set());
      setSummary(payload.summary || null);
      setCurrentUploadId(payload.uploadId || null);
      setCurrentUploadName(
        payload.name || selectedFile.name || "Menu breakdown"
      );
      await loadUploads();
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const beverages = useMemo(
    () => items.filter((i) => i.isBeverage === true),
    [items]
  );
  const foods = useMemo(
    () => items.filter((i) => i.isBeverage === false),
    [items]
  );
  const unassigned = useMemo(
    () => items.filter((i) => i.isBeverage === null),
    [items]
  );
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.quantity - a.quantity),
    [items]
  );

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSection(rows: BreakdownItem[]) {
    setSelectedIds((prev) => {
      const allSelected = rows.every((r) => prev.has(r.id));
      const next = new Set(prev);
      rows.forEach((row) => {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      });
      return next;
    });
  }

  function bulkAssign(kind: "food" | "beverage") {
    if (selectedIds.size === 0) return;
    setItems((prev) =>
      prev.map((item) =>
        selectedIds.has(item.id)
          ? { ...item, isBeverage: kind === "beverage" }
          : item
      )
    );
    setSelectedIds(new Set());
  }

  function addToMenu(name: string) {
    try {
      sessionStorage.setItem("ezinv.menu.prefill", name);
    } catch {
      // ignore storage issues
    }
    navigate("/menu");
  }

  async function openUpload(id: string) {
    if (!token) return;
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/menu-breakdown/uploads/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Failed to open (${res.status})`);
      const rawItems: ApiBreakdownItem[] = Array.isArray(body.items)
        ? body.items
        : [];
      setItems(sortItems(rawItems));
      setSummary(body.summary || null);
      setCurrentUploadId(id);
      setCurrentUploadName(body.upload?.originalName || "Menu breakdown");
      setSelectedIds(new Set());
      setSelectedFile(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to open saved breakdown");
    }
  }

  async function saveBreakdown() {
    if (!token || !currentUploadId || items.length === 0) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/menu-breakdown/uploads/${currentUploadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map(({ id, ...rest }) => rest),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to save (${res.status})`);
      setSummary(body.summary || summary);
    } catch (e: any) {
      setError(e.message ?? "Failed to save breakdown");
    } finally {
      setSaving(false);
    }
  }

  async function renameBreakdown() {
    if (!token || !currentUploadId || !currentUploadName.trim()) return;
    try {
      const res = await fetch(`${apiBase}/api/menu-breakdown/uploads/${currentUploadId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: currentUploadName.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to rename (${res.status})`);
      setUploads((prev) =>
        prev.map((u) =>
          u.id === currentUploadId ? { ...u, originalName: currentUploadName.trim() } : u
        )
      );
    } catch (e: any) {
      setError(e.message ?? "Failed to rename breakdown");
    }
  }

  async function deleteBreakdown(id: string) {
    if (!token) return;
    if (!window.confirm("Delete this breakdown? This cannot be undone.")) return;
    try {
      const res = await fetch(`${apiBase}/api/menu-breakdown/uploads/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed to delete (${res.status})`);
      setUploads((prev) => prev.filter((u) => u.id !== id));
      if (currentUploadId === id) {
        setCurrentUploadId(null);
        setCurrentUploadName("");
        setItems([]);
        setSummary(null);
        setSelectedIds(new Set());
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to delete breakdown");
    }
  }

  function drawPie(
    canvas: HTMLCanvasElement | null,
    slices: { label: string; value: number; color: string }[],
    title: string
  ) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const total = slices.reduce((sum, s) => sum + s.value, 0);
    const size = Math.min(canvas.width, canvas.height);
    const radius = size / 2 - 10;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (total === 0) {
      ctx.fillStyle = "#888";
      ctx.textAlign = "center";
      ctx.font = "14px sans-serif";
      ctx.fillText("No data", centerX, centerY);
      return;
    }

    let start = -Math.PI / 2;
    slices.forEach((slice) => {
      const angle = (slice.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();

      const mid = start + angle / 2;
      const labelX = centerX + Math.cos(mid) * (radius * 0.62);
      const labelY = centerY + Math.sin(mid) * (radius * 0.62);
      ctx.fillStyle = "#111";
      ctx.font = "12px sans-serif";
      const pct = Math.round((slice.value / total) * 100);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${pct}%`, labelX, labelY);

      start += angle;
    });

    ctx.fillStyle = "#fff";
    ctx.font = "13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, centerX, canvas.height - 8);
  }

  const foodQuantity = foods.reduce((sum, i) => sum + i.quantity, 0);
  const beverageQuantity = beverages.reduce((sum, i) => sum + i.quantity, 0);
  const unassignedQuantity = unassigned.reduce((sum, i) => sum + i.quantity, 0);

  useEffect(() => {
    drawPie(
      foodDrinkCanvasRef.current,
      [
        { label: "Food", value: foodQuantity, color: "#7c5cff" },
        { label: "Drink", value: beverageQuantity, color: "#00c7a5" },
        { label: "Unassigned", value: unassignedQuantity, color: "#f59e0b" },
      ],
      "Qty by type"
    );
    drawPie(
      topItemsCanvasRef.current,
      sortedItems.slice(0, 8).map((item, idx) => ({
        label: item.name,
        value: item.quantity,
        color: ["#7c5cff", "#00c7a5", "#ff9f1c", "#ff7b9c", "#19b2ff", "#c29bff", "#5adbb5", "#f1c40f"][idx % 8],
      })),
      "Top items by qty"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, foodQuantity, beverageQuantity, sortedItems]);

  function downloadPdf() {
    const pie1 = foodDrinkCanvasRef.current?.toDataURL("image/png");
    const pie2 = topItemsCanvasRef.current?.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) {
      setError("Popup blocked. Allow popups to download the PDF.");
      return;
    }
    const periodText =
      summary?.periodStart && summary?.periodEnd
        ? `${new Date(summary.periodStart).toLocaleDateString()} → ${new Date(
            summary.periodEnd
          ).toLocaleDateString()}`
        : "";
    const now = new Date().toLocaleString();
    const colorStripe =
      "linear-gradient(135deg, #111827 0%, #111827 52%, #1f2937 100%)";
    const cardBg = "#0f172a";
    const border = "#1f2937";

    const foodRows = foods
      .sort((a, b) => b.quantity - a.quantity)
      .map(
        (item, idx) => `<tr>
          <td>${idx + 1}</td>
          <td>${item.modifier ? `${item.name} (${item.modifier})` : item.name}</td>
          <td>${item.category || "Uncategorized"}</td>
          <td>${item.quantity.toLocaleString()}</td>
          <td>${item.netSales ? `$${item.netSales.toLocaleString()}` : "—"}</td>
        </tr>`
      )
      .join("");

    const beverageRows = beverages
      .sort((a, b) => b.quantity - a.quantity)
      .map(
        (item, idx) => `<tr>
          <td>${idx + 1}</td>
          <td>${item.modifier ? `${item.name} (${item.modifier})` : item.name}</td>
          <td>${item.category || "Uncategorized"}</td>
          <td>${item.quantity.toLocaleString()}</td>
          <td>${item.netSales ? `$${item.netSales.toLocaleString()}` : "—"}</td>
        </tr>`
      )
      .join("");

    win.document.write(`
      <html>
        <head>
          <title>Menu breakdown report</title>
          <style>
            body { font-family: "Inter", "Helvetica Neue", Arial, sans-serif; padding: 0; margin: 0; background: ${colorStripe}; color: #e5e7eb; }
            .wrap { padding: 28px; }
            h1 { margin: 0 0 6px; letter-spacing: 0.4px; }
            h2 { margin: 18px 0 8px; letter-spacing: 0.3px; }
            .muted { color: #9ca3af; }
            .grid { display: flex; gap: 16px; flex-wrap: wrap; }
            .card { border: 1px solid ${border}; border-radius: 14px; padding: 14px; background: ${cardBg}; box-shadow: 0 20px 40px rgba(0,0,0,0.35); }
            .pill { display: inline-block; padding: 6px 12px; border-radius: 999px; background: rgba(124,92,255,0.14); color: #c4b5fd; font-weight: 600; letter-spacing: 0.4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
            th, td { border: 1px solid ${border}; padding: 8px 10px; text-align: left; }
            th { background: rgba(255,255,255,0.03); text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; }
            .section-title { display: flex; align-items: center; gap: 8px; }
            .stat { font-size: 22px; font-weight: 700; color: #f8fafc; }
            .stat-label { color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .charts { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 14px; }
            .chart-card { background: ${cardBg}; border: 1px solid ${border}; border-radius: 14px; padding: 12px; flex: 1 1 320px; text-align: center; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
              <div>
                <div class="pill">${periodText || "Menu breakdown"}</div>
                <h1>${currentUploadName || "Menu breakdown report"}</h1>
                <p class="muted">Generated ${now}</p>
              </div>
            </div>

            <div class="grid" style="margin-top:14px;">
              <div class="card" style="flex:1 1 220px;">
                <div class="stat">${summary?.totalItems ?? items.length}</div>
                <div class="stat-label">Items parsed</div>
              </div>
              <div class="card" style="flex:1 1 220px;">
                <div class="stat">${summary?.totalQuantity?.toLocaleString() ?? "—"}</div>
                <div class="stat-label">Qty sold</div>
              </div>
              <div class="card" style="flex:1 1 220px;">
                <div class="stat">${summary?.missingRecipeCount ?? 0}</div>
                <div class="stat-label">Missing recipes</div>
              </div>
              <div class="card" style="flex:1 1 220px;">
                <div class="stat">${
                  summary?.totalNetSales
                    ? `$${summary.totalNetSales.toLocaleString()}`
                    : "—"
                }</div>
                <div class="stat-label">Net sales</div>
              </div>
            </div>

            <div class="charts">
              ${pie1 ? `<div class="chart-card"><img src="${pie1}" width="340" height="240"/><p class="muted">Food vs drink quantity</p></div>` : ""}
              ${pie2 ? `<div class="chart-card"><img src="${pie2}" width="340" height="240"/><p class="muted">Top sellers by quantity</p></div>` : ""}
            </div>

            <h2 class="section-title" style="margin-top:18px;">Food items</h2>
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Category</th><th>Qty</th><th>Net Sales</th></tr></thead>
              <tbody>${foodRows || "<tr><td colspan='5'>No food items</td></tr>"}</tbody>
            </table>

            <h2 class="section-title" style="margin-top:18px;">Beverages</h2>
            <table>
              <thead><tr><th>#</th><th>Name</th><th>Category</th><th>Qty</th><th>Net Sales</th></tr></thead>
              <tbody>${beverageRows || "<tr><td colspan='5'>No beverages</td></tr>"}</tbody>
            </table>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 300);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  return (
    <div>
      <h1>Menu Breakdown</h1>
      <p>
        Drop the latest “menu breakdown” export. We’ll parse items, flag which
        already have recipes, and surface beverages separately. Missing recipes
        get an “add to menu” shortcut so you can wire them for advanced metrics.
        You can multi-select rows and quickly mark them as food or drink to
        clean up the split.
      </p>

      {uploads.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h3 style={{ margin: 0 }}>Saved breakdowns</h3>
            <button type="button" onClick={loadUploads}>
              Refresh
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {uploads.map((u) => (
              <div
                key={u.id}
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  onClick={() => openUpload(u.id)}
                  style={{
                    border:
                      currentUploadId === u.id ? "2px solid var(--primary)" : "",
                  }}
                >
                  {u.originalName}
                  {u.periodStart && u.periodEnd
                    ? ` (${new Date(u.periodStart).toLocaleDateString()} → ${new Date(
                        u.periodEnd
                      ).toLocaleDateString()})`
                    : ""}
                </button>
                <button
                  type="button"
                  onClick={() => deleteBreakdown(u.id)}
                  style={{ background: "transparent", color: "crimson" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {currentUploadId && (
        <div
          className="card"
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ margin: 0, color: "var(--muted)" }}>Breakdown name</p>
            <input
              type="text"
              value={currentUploadName}
              onChange={(e) => setCurrentUploadName(e.target.value)}
              style={{ minWidth: 220 }}
            />
          </div>
          <button type="button" onClick={renameBreakdown} disabled={!currentUploadName.trim()}>
            Rename
          </button>
          <button
            type="button"
            onClick={() => deleteBreakdown(currentUploadId)}
            style={{ background: "transparent", color: "crimson" }}
          >
            Delete breakdown
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div
          className="card"
          style={{
            marginTop: 18,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ margin: 0, color: "var(--muted)" }}>Selected rows</p>
            <strong>{selectedIds.size}</strong>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => bulkAssign("food")}
              disabled={selectedIds.size === 0}
            >
              Mark as food
            </button>
            <button
              type="button"
              onClick={() => bulkAssign("beverage")}
              disabled={selectedIds.size === 0}
            >
              Mark as drink
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              disabled={selectedIds.size === 0}
            >
              Clear selection
            </button>
            <button
              type="button"
              onClick={saveBreakdown}
              disabled={!currentUploadId || saving}
            >
              {saving ? "Saving…" : "Save breakdown"}
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={items.length === 0}
            >
              Download PDF report
            </button>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div
          className="card"
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <canvas ref={foodDrinkCanvasRef} width={340} height={240} />
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Food vs drink quantity
            </p>
          </div>
          <div style={{ textAlign: "center" }}>
            <canvas ref={topItemsCanvasRef} width={340} height={240} />
            <p style={{ margin: 0, color: "var(--muted)" }}>
              Top sellers by quantity
            </p>
          </div>
        </div>
      )}

      {foods.length > 0 && (
        <Section
          title="Food items"
          subtitle="Items we expect to have recipes for"
          rows={foods}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleSection={toggleSection}
          onAdd={addToMenu}
        />
      )}

      {beverages.length > 0 && (
        <Section
          title="Beverages"
          subtitle="Drinks, beer, wine, cocktails — track separately"
          rows={beverages}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleSection={toggleSection}
          onAdd={addToMenu}
        />
      )}

      {unassigned.length > 0 && (
        <Section
          title="Unassigned"
          subtitle="New items — pick food or drink using the bulk buttons above"
          rows={unassigned}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleSection={toggleSection}
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
  selectedIds,
  onToggleRow,
  onToggleSection,
  onAdd,
}: {
  title: string;
  subtitle?: string;
  rows: BreakdownItem[];
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleSection: (rows: BreakdownItem[]) => void;
  onAdd: (name: string) => void;
}) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));

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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onToggleSection(rows)}
            />
            <span style={{ color: "var(--muted)", fontSize: 12 }}>
              Select {allSelected ? "none" : "all"} in this list
            </span>
          </label>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th />
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
            <tr key={item.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleRow(item.id)}
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => onToggleRow(item.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                    color: "inherit",
                  }}
                >
                  {item.modifier ? `${item.name} (${item.modifier})` : item.name}
                </button>
              </td>
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
