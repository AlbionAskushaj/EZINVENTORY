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

      <form onSubmit={createUnit} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="Code (e.g., ML)"
            value={form.code}
            onChange={(e) =>
              setForm({ ...form, code: e.target.value.toUpperCase() })
            }
            required
          />
          <input
            placeholder="Name (e.g., Milliliters)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
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
          <button type="submit">Create</button>
        </div>
      </form>

      {error && (
        <div style={{ color: "#ff7b9c", marginBottom: 12 }}>{error}</div>
      )}

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
            {units.map((u) => {
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
