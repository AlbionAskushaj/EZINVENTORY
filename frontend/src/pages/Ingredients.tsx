import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";

const INGREDIENT_CATEGORIES = [
  "dry",
  "produce",
  "meat",
  "dairy",
  "bar",
  "seafood",
  "grocery",
] as const;
type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];
const categoryLabel = (value: IngredientCategory) =>
  value.charAt(0).toUpperCase() + value.slice(1);

type Unit = {
  _id: string;
  code: string;
  name: string;
  precision: number;
};

type Ingredient = {
  _id?: string;
  sku: string;
  name: string;
  category: IngredientCategory;
  baseUnit: string; // unit id
  parLevel: number;
  currentQty: number;
  active?: boolean;
};

export default function IngredientsPage() {
  const { token } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  const [form, setForm] = useState<Ingredient>({
    sku: "",
    name: "",
    category: INGREDIENT_CATEGORIES[0],
    baseUnit: "",
    parLevel: 0,
    currentQty: 0,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Ingredient>({
    sku: "",
    name: "",
    category: INGREDIENT_CATEGORIES[0],
    baseUnit: "",
    parLevel: 0,
    currentQty: 0,
  });

  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [quickUnit, setQuickUnit] = useState<Unit>({
    code: "",
    name: "",
    precision: 0,
  });

  const ingredientsUrl = `${import.meta.env.VITE_API_URL}/api/ingredients`;
  const unitsUrl = `${import.meta.env.VITE_API_URL}/api/units`;

  const unitIdToLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units) map.set(u._id, `${u.code} — ${u.name}`);
    return map;
  }, [units]);

  async function loadAll() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [ingRes, unitRes] = await Promise.all([
        fetch(`${ingredientsUrl}?active=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(unitsUrl, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [ing, unit] = await Promise.all([ingRes.json(), unitRes.json()]);
      setIngredients(ing);
      setUnits(unit);
      if (unit.length > 0 && !form.baseUnit) {
        setForm((f) => ({ ...f, baseUnit: unit[0]._id }));
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function createIngredient(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await fetch(ingredientsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sku: form.sku,
          name: form.name,
          category: form.category,
          baseUnit: form.baseUnit,
          parLevel: Number(form.parLevel),
          currentQty: Number(form.currentQty),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      setForm({
        sku: "",
        name: "",
        category: INGREDIENT_CATEGORIES[0],
        baseUnit: units[0]?._id || "",
        parLevel: 0,
        currentQty: 0,
      });
      setNotice("Ingredient created");
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? "Failed to create ingredient");
    }
  }

  function startEdit(ing: Ingredient) {
    setEditingId(ing._id || null);
    setEditForm({
      sku: ing.sku,
      name: ing.name,
      category: ing.category,
      baseUnit: ing.baseUnit,
      parLevel: ing.parLevel,
      currentQty: ing.currentQty ?? 0,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setError("");
    try {
      const res = await fetch(`${ingredientsUrl}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name,
          category: editForm.category,
          baseUnit: editForm.baseUnit,
          parLevel: Number(editForm.parLevel),
          currentQty: Number(editForm.currentQty),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      setEditingId(null);
      setNotice("Ingredient updated");
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? "Failed to update ingredient");
    }
  }

  function toOrder(par: number, current: number) {
    const delta = Number(par) - Number(current);
    return delta > 0 ? delta : 0;
  }

  function startAdjust(id: string) {
    setAdjustId(id);
    setAdjustDelta(0);
    setAdjustReason("");
  }

  function cancelAdjust() {
    setAdjustId(null);
    setAdjustDelta(0);
    setAdjustReason("");
  }

  const filteredIngredients = ingredients.filter((ing) => {
    const matchesSearch =
      ing.name.toLowerCase().includes(search.toLowerCase()) ||
      ing.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      filterCategory === "all" ? true : ing.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  async function saveAdjust(id: string) {
    setError("");
    try {
      const res = await fetch(`${ingredientsUrl}/${id}/adjust`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          delta: Number(adjustDelta),
          reason: adjustReason || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      cancelAdjust();
      setNotice("Stock adjusted");
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? "Failed to adjust stock");
    }
  }

  async function createQuickUnit() {
    if (!quickUnit.code || !quickUnit.name) return;
    setError("");
    try {
      const res = await fetch(unitsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          code: quickUnit.code.toUpperCase(),
          name: quickUnit.name,
          precision: Number(quickUnit.precision || 0),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setQuickUnit({ code: "", name: "", precision: 0 });
      setNotice("Unit created and ready to use");
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? "Failed to create unit");
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Ingredients</h2>
      {(notice || error) && (
        <div style={{ marginBottom: 10, color: error ? "#ff7b9c" : "#4ade80" }}>
          {error || notice}
        </div>
      )}

      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label>Search</label>
          <input
            placeholder="Search by SKU or name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label>Filter by category</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All</option>
            {INGREDIENT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label>Quick unit (for this form)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <input
              placeholder="Code"
              value={quickUnit.code}
              onChange={(e) =>
                setQuickUnit({ ...quickUnit, code: e.target.value.toUpperCase() })
              }
              style={{ width: 80 }}
            />
            <input
              placeholder="Name"
              value={quickUnit.name}
              onChange={(e) =>
                setQuickUnit({ ...quickUnit, name: e.target.value })
              }
              style={{ minWidth: 140 }}
            />
            <input
              type="number"
              min={0}
              max={6}
              value={quickUnit.precision}
              onChange={(e) =>
                setQuickUnit({
                  ...quickUnit,
                  precision: Number(e.target.value),
                })
              }
              style={{ width: 80 }}
            />
            <button type="button" onClick={createQuickUnit}>
              Save unit
            </button>
          </div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Create a missing unit without leaving this page.
          </div>
        </div>
      </div>

      <form onSubmit={createIngredient} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>SKU</label>
            <input
              placeholder="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Name</label>
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Category</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as Ingredient["category"],
                })
              }
            >
              {INGREDIENT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Base Unit</label>
            <select
              value={form.baseUnit}
              onChange={(e) => setForm({ ...form, baseUnit: e.target.value })}
              required
            >
              {units.map((u) => (
                <option key={u._id} value={u._id}>
                  {unitIdToLabel.get(u._id)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Par Level</label>
            <input
              type="number"
              placeholder="Par level"
              min={0}
              value={form.parLevel}
              onChange={(e) =>
                setForm({ ...form, parLevel: Number(e.target.value) })
              }
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Current Quantity</label>
            <input
              type="number"
              placeholder="Current qty"
              min={0}
              value={form.currentQty}
              onChange={(e) =>
                setForm({ ...form, currentQty: Number(e.target.value) })
              }
            />
          </div>
          <div style={{ alignSelf: "end" }}>
            <button type="submit" disabled={units.length === 0}>
              Create
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div style={{ color: "#ff7b9c", marginBottom: 12 }}>{error}</div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : filteredIngredients.length === 0 ? (
        <div>No ingredients yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Category</th>
              <th>Base Unit</th>
              <th>Par Level</th>
              <th>Current</th>
              <th>To Order</th>
              <th style={{ width: 320 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredIngredients.map((ing) => {
              const isEditing = editingId === ing._id;
              const isAdjusting = adjustId === ing._id;
              return (
                <tr key={ing._id || ing.sku}>
                  <td>{ing.sku}</td>
                  <td>
                    {isEditing ? (
                      <input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                      />
                    ) : (
                      ing.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={editForm.category}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            category: e.target.value as Ingredient["category"],
                          })
                        }
                      >
                        {INGREDIENT_CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {categoryLabel(cat)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ing.category
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={editForm.baseUnit}
                        onChange={(e) =>
                          setEditForm({ ...editForm, baseUnit: e.target.value })
                        }
                      >
                        {units.map((u) => (
                          <option key={u._id} value={u._id}>
                            {unitIdToLabel.get(u._id)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      unitIdToLabel.get(ing.baseUnit) || ing.baseUnit
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        value={editForm.parLevel}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            parLevel: Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      ing.parLevel
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        value={editForm.currentQty}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            currentQty: Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      ing.currentQty ?? 0
                    )}
                  </td>
                  <td>{toOrder(ing.parLevel ?? 0, ing.currentQty ?? 0)}</td>
                  <td>
                    {isEditing ? (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          onClick={() => saveEdit(ing._id!)}
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    ) : isAdjusting ? (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <input
                          type="number"
                          placeholder="Δ qty"
                          value={adjustDelta}
                          onChange={(e) =>
                            setAdjustDelta(Number(e.target.value))
                          }
                          style={{ width: 100 }}
                        />
                        <input
                          placeholder="Reason (optional)"
                          value={adjustReason}
                          onChange={(e) => setAdjustReason(e.target.value)}
                          style={{ width: 200 }}
                        />
                        <button
                          type="button"
                          onClick={() => saveAdjust(ing._id!)}
                        >
                          Apply
                        </button>
                        <button type="button" onClick={cancelAdjust}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button type="button" onClick={() => startEdit(ing)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => startAdjust(ing._id!)}
                        >
                          Adjust
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
