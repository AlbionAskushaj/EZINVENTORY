import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Unit = {
  _id?: string;
  code: string;
  name: string;
  precision: number;
};

export default function UnitsPage() {
  const { token } = useAuth();
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Unit>({ code: "", name: "", precision: 0 });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Unit>({
    code: "",
    name: "",
    precision: 0,
  });

  const baseUrl = `${import.meta.env.VITE_API_URL}/api/units`;

  async function loadUnits() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(baseUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUnits(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load units");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createUnit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          precision: Number(form.precision),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      setForm({ code: "", name: "", precision: 0 });
      setNotice("Unit created");
      await loadUnits();
    } catch (e: any) {
      setError(e.message ?? "Failed to create unit");
    }
  }

  function startEdit(u: Unit) {
    setEditingId(u._id || null);
    setEditForm({ code: u.code, name: u.name, precision: u.precision });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setError("");
    try {
      const res = await fetch(`${baseUrl}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: editForm.code,
          name: editForm.name,
          precision: Number(editForm.precision),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      setEditingId(null);
      await loadUnits();
    } catch (e: any) {
      setError(e.message ?? "Failed to update unit");
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Units</h2>
      {(notice || error) && (
        <div style={{ marginBottom: 10, color: error ? "#ff7b9c" : "#4ade80" }}>
          {error || notice}
        </div>
      )}

      <form onSubmit={createUnit} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Code</label>
            <input
              placeholder="Code (e.g., ML)"
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase() })
              }
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Name</label>
            <input
              placeholder="Name (e.g., Milliliters)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Precision</label>
            <input
              type="number"
              placeholder="Precision"
              value={form.precision}
              min={0}
              max={6}
              onChange={(e) =>
                setForm({ ...form, precision: Number(e.target.value) })
              }
              required
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit">Create</button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { code: "EA", name: "Each", precision: 0 },
              { code: "KG", name: "Kilograms", precision: 3 },
              { code: "LB", name: "Pounds", precision: 2 },
              { code: "ML", name: "Milliliters", precision: 0 },
              { code: "L", name: "Liters", precision: 3 },
            ].map((preset) => (
              <button
                key={preset.code}
                type="button"
                onClick={() => setForm(preset)}
                style={{ padding: "6px 10px" }}
              >
                Use {preset.code}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
        <input
          placeholder="Search units"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 240 }}
        />
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : units.length === 0 ? (
        <div>No units yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Precision</th>
              <th style={{ width: 180 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {units
              .filter(
                (u) =>
                  u.code.toLowerCase().includes(search.toLowerCase()) ||
                  u.name.toLowerCase().includes(search.toLowerCase())
              )
              .map((u) => {
              const isEditing = editingId === u._id;
              return (
                <tr key={u._id || u.code}>
                  <td>
                    {isEditing ? (
                      <input
                        value={editForm.code}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            code: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    ) : (
                      u.code
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    ) : (
                      u.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={editForm.precision}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            precision: Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      u.precision
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => saveEdit(u._id!)}>
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => startEdit(u)}>
                          Edit
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
