import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

type SalesUpload = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  netSales?: number;
  periodStart?: string;
  periodEnd?: string;
  storedAt?: string;
};

export default function SalesPage() {
  const { token } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<SalesUpload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const apiBase = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;
    fetch(`${apiBase}/api/sales/uploads`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setUploads(data.uploads || []))
      .catch(() => setUploads([]));
  }, [apiBase, token]);

  async function handleUpload() {
    if (!selectedFile || !token) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", selectedFile);
      const res = await fetch(`${apiBase}/api/sales/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const payload = await res.json();
      setUploads((prev) => [payload.upload, ...prev]);
      setSelectedFile(null);
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const latest = uploads[0];
  const targetFoodCostPct = 0.3;
  const periodDays = useMemo(() => {
    if (!latest?.periodStart || !latest?.periodEnd) return 7;
    const start = new Date(latest.periodStart);
    const end = new Date(latest.periodEnd);
    const diff = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
    );
    return diff;
  }, [latest]);

  const expectedCogs = latest?.netSales
    ? latest.netSales * targetFoodCostPct
    : null;
  const dailyBurn = expectedCogs ? expectedCogs / periodDays : null;

  return (
    <div>
      <h1>Sales Uploads</h1>
      <p>
        Drop sales exports (CSV/PDF). We store them to your account and pull net
        sales to estimate expected food cost and inventory burn. Hook this to
        menu-level usage later for full variance.
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
          borderColor: dragging ? "#00ffa3" : "#666",
          padding: "32px 16px",
          textAlign: "center",
          background: dragging ? "rgba(0,255,163,0.08)" : "transparent",
          marginBottom: 14,
        }}
      >
        <p style={{ margin: 0 }}>
          {selectedFile
            ? selectedFile.name
            : "Drag a sales export here or click to browse"}
        </p>
        <input
          type="file"
          accept=".csv,application/pdf,text/csv"
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
        {uploading ? "Uploading…" : "Upload sales file"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: 10 }}>
          <strong>Error:</strong> {error}
        </p>
      )}

      <div
        className="card"
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <MetricCard
          label="Latest net sales"
          value={
            latest?.netSales
              ? `$${latest.netSales.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "—"
          }
          hint={latest?.originalName || "Upload to populate"}
        />
        <MetricCard
          label="Expected COGS (target 30%)"
          value={
            expectedCogs
              ? `$${expectedCogs.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "—"
          }
          hint="Net sales × food cost target"
        />
        <MetricCard
          label="Est. daily inventory burn"
          value={
            dailyBurn
              ? `$${dailyBurn.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "—"
          }
          hint={latest?.periodStart ? `${periodDays} day period` : "Assumes 7 days"}
        />
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <h3 style={{ margin: 0 }}>Recent uploads (stored per user)</h3>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            Latest 25
          </span>
        </div>
        {uploads.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No sales uploads yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Net sales</th>
                <th>Period</th>
                <th>Stored</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((u) => (
                <tr key={u.id}>
                  <td>{u.originalName}</td>
                  <td>
                    {u.netSales
                      ? `$${u.netSales.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}`
                      : "—"}
                  </td>
                  <td>
                    {u.periodStart && u.periodEnd
                      ? `${new Date(u.periodStart).toLocaleDateString()} → ${new Date(
                          u.periodEnd
                        ).toLocaleDateString()}`
                      : "—"}
                  </td>
                  <td>
                    {u.storedAt
                      ? new Date(u.storedAt).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>{Math.round(u.size / 1024)} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MetricCard({
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
