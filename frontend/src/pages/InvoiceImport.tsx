import { useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../context/AuthContext";

type ImportOutcome = {
  sku: string;
  ingredientId: string;
  name: string;
  created: boolean;
  quantityAdded: number;
  unitCode: string;
  category: string;
  brand?: string;
  packSize?: string;
  unitCost?: number;
  extendedCost?: number;
};

type PreviewItem = {
  sku: string;
  name: string;
  quantity: number;
  unitCode: string;
  category: string;
  brand?: string;
  packSize?: string;
  unitCost?: number;
  extendedCost?: number;
  exists: boolean;
  ingredientId?: string;
};

type PreviewResponse = {
  invoice: {
    number?: string;
    date?: string;
    purchaseOrder?: string;
  };
  items: PreviewItem[];
};

export default function InvoiceImportPage() {
  const { token } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [reviewItems, setReviewItems] = useState<
    Array<PreviewItem & { apply: boolean }>
  >([]);
  const [result, setResult] = useState<ImportOutcome[] | null>(null);

  const apiBase = import.meta.env.VITE_API_URL;

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.includes("pdf")) {
      setError("Please select a PDF file");
      return;
    }
    setSelectedFile(file);
    setPreview(null);
    setReviewItems([]);
    setResult(null);
    setError("");
  }

  async function generatePreview() {
    if (!selectedFile || !token) return;
    setPreviewing(true);
    setError("");
    setPreview(null);
    setReviewItems([]);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const res = await fetch(`${apiBase}/api/invoices/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const payload = (await res.json()) as PreviewResponse;
      setPreview(payload);
      setReviewItems(payload.items.map((item) => ({ ...item, apply: true })));
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setPreviewing(false);
    }
  }

  const selectedCount = useMemo(
    () => reviewItems.filter((item) => item.apply).length,
    [reviewItems]
  );

  function toggleApply(index: number) {
    setReviewItems((items) =>
      items.map((item, i) => (i === index ? { ...item, apply: !item.apply } : item))
    );
  }

  function setAllApply(value: boolean) {
    setReviewItems((items) => items.map((item) => ({ ...item, apply: value })));
  }

  async function applySelected() {
    if (!token || reviewItems.length === 0 || !preview) return;
    setApplying(true);
    setError("");
    try {
      const res = await fetch(`${apiBase}/api/invoices/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoice: preview.invoice,
          items: reviewItems.map(({ apply, ...rest }) => ({ ...rest, apply })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Apply failed (${res.status})`);
      }
      const payload = (await res.json()) as { items: ImportOutcome[] };
      setResult(payload.items);
    } catch (e: any) {
      setError(e.message ?? "Apply failed");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div>
      <h1>Invoice Import</h1>
      <p>
        Drop a vendor invoice PDF here and we’ll parse the line items, add any
        missing ingredients, and update stock automatically.
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
          handleFiles(e.dataTransfer.files);
        }}
        style={{
          border: "2px dashed #666",
          padding: "40px 16px",
          textAlign: "center",
          borderColor: dragging ? "#1d72b8" : "#666",
          background: dragging ? "rgba(29, 114, 184, 0.1)" : "transparent",
          marginBottom: 16,
        }}
      >
        <p style={{ margin: 0 }}>
          {selectedFile
            ? selectedFile.name
            : "Drag a PDF here or click to browse"}
        </p>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleFiles(e.target.files)}
          style={{ marginTop: 12 }}
        />
      </div>

      <button
        type="button"
        onClick={generatePreview}
        disabled={!selectedFile || previewing}
      >
        {previewing ? "Parsing…" : "Preview Invoice"}
      </button>

      {error && (
        <p style={{ color: "crimson", marginTop: 12 }}>
          <strong>Error:</strong> {error}
        </p>
      )}

      {preview && (
        <div style={{ marginTop: 24 }}>
          <h2>Review Line Items</h2>
          <p>
            <strong>Invoice:</strong>{" "}
            {preview.invoice.number || "Unknown"} (
            {preview.invoice.date || "No date"}) — PO{" "}
            {preview.invoice.purchaseOrder || "N/A"}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => setAllApply(true)}>
              Select All
            </button>
            <button type="button" onClick={() => setAllApply(false)}>
              Clear All
            </button>
            <span style={{ alignSelf: "center" }}>
              {selectedCount} of {reviewItems.length} selected
            </span>
            <button
              type="button"
              onClick={applySelected}
              disabled={selectedCount === 0 || applying}
              style={{ marginLeft: "auto" }}
            >
              {applying ? "Applying…" : "Apply Selected Items"}
            </button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Apply</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Qty</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reviewItems.map((item, index) => (
                <tr key={`${item.sku}-${index}`}>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={item.apply}
                      onChange={() => toggleApply(index)}
                    />
                  </td>
                  <td style={tdStyle}>{item.sku}</td>
                  <td style={tdStyle}>
                    {item.brand ? `${item.brand} ` : ""}
                    {item.name}
                  </td>
                  <td style={tdStyle}>{item.quantity}</td>
                  <td style={tdStyle}>{item.unitCode}</td>
                  <td style={tdStyle}>{item.category}</td>
                  <td style={tdStyle}>{item.exists ? "Existing" : "New"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div style={{ marginTop: 24 }}>
          <h2>Results</h2>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Qty Added</th>
                <th style={thStyle}>Unit</th>
                <th style={thStyle}>Category</th>
                <th style={thStyle}>New?</th>
              </tr>
            </thead>
            <tbody>
              {result.map((item) => (
                <tr key={`${item.ingredientId}-${item.sku}`}>
                  <td style={tdStyle}>{item.sku}</td>
                  <td style={tdStyle}>
                    {item.brand ? `${item.brand} ` : ""}
                    {item.name}
                  </td>
                  <td style={tdStyle}>{item.quantityAdded}</td>
                  <td style={tdStyle}>{item.unitCode}</td>
                  <td style={tdStyle}>{item.category}</td>
                  <td style={tdStyle}>{item.created ? "✅" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "8px",
};

const tdStyle: CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px",
};
