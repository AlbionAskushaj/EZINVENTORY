import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Ingredient = {
  _id: string;
  name: string;
  avgCost?: number;
};

type MenuItemIngredient = {
  ingredient: string;
  quantity: number;
  unitCost?: number;
};

type MenuItem = {
  _id?: string;
  name: string;
  price: number;
  kind?: "food" | "beverage";
  category?: string;
  targetMargin?: number;
  ingredients: MenuItemIngredient[];
  deletedAt?: string;
};

type MenuCategory = {
  _id: string;
  name: string;
  kind: "food" | "beverage";
  usageCount?: number;
};

export default function MenuPage() {
  const { token } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");
  // Success message for operations like create/update
  const [success, setSuccess] = useState<string>("");
  // Client-side validation errors for the create form
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    price?: string;
    ingredients?: string;
  }>({});
  const [form, setForm] = useState<MenuItem>({
    name: "",
    price: 0,
    kind: "food",
    category: "Uncategorized",
    ingredients: [],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MenuItem>({
    name: "",
    price: 0,
    kind: "food",
    category: "Uncategorized",
    ingredients: [],
  });
  const [categoryForm, setCategoryForm] = useState<{
    name: string;
    kind: "food" | "beverage";
  }>({ name: "", kind: "food" });
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [lastDeleted, setLastDeleted] = useState<MenuItem | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [viewArchived, setViewArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState<string>("Uncategorized");
  const [merge, setMerge] = useState<{ source: string; target: string }>({
    source: "",
    target: "",
  });
  const [purgeDays, setPurgeDays] = useState(30);

  const menuUrl = `${import.meta.env.VITE_API_URL}/api/menu`;
  const ingredientsUrl = `${import.meta.env.VITE_API_URL}/api/ingredients`;
  const categoriesUrl = `${import.meta.env.VITE_API_URL}/api/menu-categories`;

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [menuRes, ingRes, catRes] = await Promise.all([
        fetch(`${menuUrl}?active=${viewArchived ? "inactive" : "true"}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${ingredientsUrl}?active=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(categoriesUrl, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const [menuData, ingData, catData] = await Promise.all([
        menuRes.json(),
        ingRes.json(),
        catRes.json(),
      ]);
      setMenuItems(menuData);
      setCategories(catData);
      setSelectedIds(new Set());
      // simplify ingredient objects
      setIngredients(
        ingData.map((i: any) => ({
          _id: i._id,
          name: i.name,
          avgCost: i.avgCost ?? 0,
        }))
      );
      if (ingData.length > 0 && form.ingredients.length === 0) {
        // initialize with one row
        setForm((f) => ({
          ...f,
          ingredients: [{ ingredient: ingData[0]._id, quantity: 0 }],
        }));
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, viewArchived]);

  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem("ezinv.menu.prefill");
      if (prefill) {
        setForm((f) => ({ ...f, name: prefill }));
        if (nameInputRef.current) nameInputRef.current.focus();
        sessionStorage.removeItem("ezinv.menu.prefill");
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        nameInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  function addIngredientRow() {
    if (ingredients.length === 0) return;
    setForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { ingredient: ingredients[0]._id, quantity: 0 },
      ],
    }));
  }

  function removeIngredientRow(index: number) {
    setForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function createMenuItem(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setFormErrors({});
    // Perform client-side validation
    const errors: { name?: string; price?: string; ingredients?: string } = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (form.price < 0) errors.price = "Price must be ≥ 0";
    if (form.ingredients.length === 0)
      errors.ingredients = "At least one ingredient is required";
    if (form.ingredients.some((row) => row.quantity < 0))
      errors.ingredients = "Quantities must be ≥ 0";
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    try {
      const res = await fetch(menuUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          price: Number(form.price),
          kind: form.kind || "food",
          category: form.category?.trim() || "Uncategorized",
          ingredients: form.ingredients.map((row) => ({
            ingredient: row.ingredient,
            quantity: Number(row.quantity),
            ...(row.unitCost !== undefined ? { unitCost: Number(row.unitCost) } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      setSuccess("Menu item created successfully");
      setForm({
        name: "",
        price: 0,
        kind: "food",
        category: "Uncategorized",
        ingredients:
          ingredients.length > 0
            ? [{ ingredient: ingredients[0]._id, quantity: 0 }]
            : [],
      });
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to create menu item");
    }
  }

  async function bulkApplyCategory() {
    if (selectedIds.size === 0) return;
    setError("");
    try {
      const res = await fetch(`${menuUrl}/bulk-category`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          category: bulkCategory || "Uncategorized",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setNotice(`Updated category for ${selectedIds.size} items`);
      setSelectedIds(new Set());
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to update category");
    }
  }

  async function mergeCategories(e: React.FormEvent) {
    e.preventDefault();
    if (!merge.source || !merge.target || merge.source === merge.target) return;
    setError("");
    try {
      const res = await fetch(`${categoriesUrl}/merge`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sourceId: merge.source,
          targetId: merge.target,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setNotice("Merged categories");
      setMerge({ source: "", target: "" });
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to merge");
    }
  }

  async function purgeTrash() {
    setError("");
    try {
      const res = await fetch(`${menuUrl}/trash/purge?days=${purgeDays}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setNotice(`Purged ${body.purged ?? 0} items older than ${purgeDays} days`);
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to purge");
    }
  }

  function startEdit(item: MenuItem) {
    setEditingId(item._id || null);
    setEditForm({
      name: item.name,
      price: item.price,
      kind: item.kind || "food",
      category: item.category || "Uncategorized",
      ingredients: item.ingredients.map((ing) => ({
        ingredient: ing.ingredient,
        quantity: ing.quantity,
      })),
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function addEditIngredientRow() {
    if (ingredients.length === 0) return;
    setEditForm((f) => ({
      ...f,
      ingredients: [
        ...f.ingredients,
        { ingredient: ingredients[0]._id, quantity: 0 },
      ],
    }));
  }

  const filteredItems = menuItems.filter(
    (item) =>
      (filterCategory === "all"
        ? true
        : (item.category || "Uncategorized") === filterCategory) &&
      item.name.toLowerCase().includes(search.toLowerCase())
  );

  const coverage =
    filteredItems.length === 0
      ? 0
      : Math.round(
          (filteredItems.filter((i) => i.category && i.category !== "Uncategorized").length /
            filteredItems.length) *
            100
        );

  function computeMargin(item: MenuItem) {
    const cost = (item.ingredients || []).reduce((sum, ing) => {
      const fallback = ingredients.find((i) => i._id === ing.ingredient)?.avgCost ?? 0;
      const c = ing.unitCost ?? fallback;
      return sum + c * (ing.quantity || 0);
    }, 0);
    if (!item.price || item.price <= 0) return { margin: null, cost };
    return { margin: 1 - cost / item.price, cost };
  }

  const mergeSourceKind = categories.find((c) => c._id === merge.source)?.kind;
  const mergeTargetKind = categories.find((c) => c._id === merge.target)?.kind;
  const mergeKindsMismatch =
    merge.source &&
    merge.target &&
    mergeSourceKind &&
    mergeTargetKind &&
    mergeSourceKind !== mergeTargetKind;

  async function createCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(categoriesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: categoryForm.name.trim(),
          kind: categoryForm.kind,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Failed (${res.status})`);
      setCategories((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryForm({ name: "", kind: "food" });
    } catch (e: any) {
      setError(e.message ?? "Failed to add category");
    }
  }

  function removeEditIngredientRow(index: number) {
    setEditForm((f) => ({
      ...f,
      ingredients: f.ingredients.filter((_, i) => i !== index),
    }));
  }

  async function saveEdit(id: string) {
    setError("");
    try {
      const res = await fetch(`${menuUrl}/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editForm.name,
          price: Number(editForm.price),
          kind: editForm.kind || "food",
          category: editForm.category?.trim() || "Uncategorized",
          ingredients: editForm.ingredients.map((row) => ({
            ingredient: row.ingredient,
            quantity: Number(row.quantity),
            ...(row.unitCost !== undefined ? { unitCost: Number(row.unitCost) } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      setEditingId(null);
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to update menu item");
    }
  }

  async function deleteMenuItem(id: string) {
    if (!confirm("Delete this menu item?")) return;
    setError("");
    setNotice("");
    try {
      const res = await fetch(`${menuUrl}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      const removed = menuItems.find((m) => m._id === id) || null;
      setLastDeleted(removed);
      setNotice(removed ? `Deleted ${removed.name} (soft delete)` : "Deleted");
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete");
    }
  }

  async function restoreMenuItem(id: string) {
    setError("");
    try {
      const res = await fetch(`${menuUrl}/${id}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to restore (${res.status})`);
      }
      setLastDeleted(null);
      setNotice("Restored menu item");
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to restore");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Menu Items</h2>
        <button
          type="button"
          onClick={() => {
            setViewArchived((v) => !v);
            setNotice("");
            setSuccess("");
          }}
          style={{ padding: "6px 10px" }}
        >
          {viewArchived ? "← Back to Active" : "View Archived"}
        </button>
      </div>
      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <Metric label={viewArchived ? "Archived items" : "Active items"} value={`${menuItems.length}`} />
        <Metric label="Categories" value={`${categories.length}`} />
        <Metric label="Categorized coverage" value={`${coverage}%`} hint="Items with a non-uncategorized label" />
        {viewArchived && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              min={1}
              value={purgeDays}
              onChange={(e) => setPurgeDays(Math.max(1, Number(e.target.value)))}
              style={{ width: 100 }}
            />
            <span style={{ color: "var(--muted)" }}>days old</span>
            <button type="button" onClick={purgeTrash}>
              Purge archived
            </button>
          </div>
        )}
      </div>
      {(notice || success) && (
        <div style={{ marginBottom: 10, color: notice ? "#4ade80" : "#28a745" }}>
          {notice || success}
          {lastDeleted && (
            <button
              type="button"
              onClick={() => restoreMenuItem(lastDeleted._id!)}
              style={{ marginLeft: 8, padding: "4px 8px" }}
            >
              Undo
            </button>
          )}
        </div>
      )}
      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Add Category</h3>
          <form onSubmit={createCategory} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              placeholder="Category name (e.g., Red Wine)"
              value={categoryForm.name}
              onChange={(e) =>
                setCategoryForm((f) => ({ ...f, name: e.target.value }))
              }
              required
              style={{ flex: 1, minWidth: 180 }}
            />
            <select
              value={categoryForm.kind}
              onChange={(e) =>
                setCategoryForm((f) => ({
                  ...f,
                  kind: e.target.value as "food" | "beverage",
                }))
              }
            >
              <option value="food">Food</option>
              <option value="beverage">Beverage</option>
            </select>
            <button type="submit" disabled={!categoryForm.name.trim()}>
              Save
            </button>
          </form>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Categories are per restaurant; use them to group items and filter.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0 }}>Filter by category</h3>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ maxWidth: 260 }}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name} ({c.kind}
                {typeof c.usageCount === "number" ? ` · ${c.usageCount}` : ""})
              </option>
            ))}
          </select>
          <input
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Tip: Cmd/Ctrl + N focuses name to add quickly.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0 }}>Bulk assign category</h3>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            style={{ maxWidth: 260 }}
          >
            <option value="Uncategorized">Uncategorized</option>
            {categories.map((c) => (
              <option key={c._id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={bulkApplyCategory}
            disabled={selectedIds.size === 0}
            style={{ maxWidth: 200 }}
          >
            Apply to {selectedIds.size} selected
          </button>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Select rows below to quickly reclassify.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h3 style={{ margin: 0 }}>Merge categories</h3>
          <form onSubmit={mergeCategories} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              value={merge.source}
              onChange={(e) => setMerge((m) => ({ ...m, source: e.target.value }))}
              style={{ minWidth: 180 }}
            >
              <option value="">Source</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.kind}
                  {typeof c.usageCount === "number"
                    ? ` · ${c.usageCount} items`
                    : ""})
                </option>
              ))}
            </select>
            <select
              value={merge.target}
              onChange={(e) => setMerge((m) => ({ ...m, target: e.target.value }))}
              style={{ minWidth: 180 }}
            >
              <option value="">Target</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.kind}
                  {typeof c.usageCount === "number"
                    ? ` · ${c.usageCount} items`
                    : ""})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={
                !merge.source ||
                !merge.target ||
                merge.source === merge.target ||
                mergeKindsMismatch
              }
            >
              Merge
            </button>
            {mergeKindsMismatch && (
              <div style={{ color: "#ff7b9c", fontSize: 12, width: "100%" }}>
                Source and target kinds differ; merge blocked.
              </div>
            )}
          </form>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>
            Merges move items from source to target then delete source (kinds must match).
          </div>
        </div>
      </div>
      {/* Success message */}
      {success && (
        <div style={{ color: "#28a745", marginBottom: 12 }}>{success}</div>
      )}
      <form onSubmit={createMenuItem} style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="menu-name">Name</label>
            <input
              id="menu-name"
              placeholder="Menu item name"
              value={form.name}
              ref={nameInputRef}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            {formErrors.name && (
              <span style={{ color: "#ff7b9c", fontSize: "0.875em" }}>
                {formErrors.name}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="menu-price">Price</label>
            <input
              id="menu-price"
              type="number"
              min={0}
              step="0.01"
              value={form.price}
              onChange={(e) =>
                setForm({ ...form, price: Number(e.target.value) })
              }
              required
            />
            {formErrors.price && (
              <span style={{ color: "#ff7b9c", fontSize: "0.875em" }}>
                {formErrors.price}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label>Type</label>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="radio"
                  name="menu-kind"
                  value="food"
                  checked={form.kind === "food"}
                  onChange={() => setForm({ ...form, kind: "food" })}
                />
                Food
              </label>
              <label style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input
                  type="radio"
                  name="menu-kind"
                  value="beverage"
                  checked={form.kind === "beverage"}
                  onChange={() => setForm({ ...form, kind: "beverage" })}
                />
                Beverage
              </label>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="menu-category">Category</label>
            <select
              id="menu-category"
              value={form.category || "Uncategorized"}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              <option value="Uncategorized">Uncategorized</option>
              {categories
                .filter((c) => c.kind === (form.kind || "food"))
                .map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                    {typeof c.usageCount === "number"
                      ? ` · ${c.usageCount}`
                      : ""}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>Ingredients</label>
          {form.ingredients.map((row, idx) => (
            <div
              key={idx}
              style={{ display: "flex", gap: 8, alignItems: "center" }}
            >
              <select
                value={row.ingredient}
                onChange={(e) =>
                  setForm((f) => {
                    const newRows = [...f.ingredients];
                    newRows[idx] = {
                      ...newRows[idx],
                      ingredient: e.target.value,
                    };
                    return { ...f, ingredients: newRows };
                  })
                }
              >
                {ingredients.map((ing) => (
                  <option key={ing._id} value={ing._id}>
                    {ing.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Quantity"
                value={row.quantity}
                onChange={(e) =>
                  setForm((f) => {
                    const newRows = [...f.ingredients];
                    newRows[idx] = {
                      ...newRows[idx],
                      quantity: Number(e.target.value),
                    };
                    return { ...f, ingredients: newRows };
                  })
                }
                style={{ width: 100 }}
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Unit cost (optional)"
                value={row.unitCost ?? ""}
                onChange={(e) =>
                  setForm((f) => {
                    const newRows = [...f.ingredients];
                    newRows[idx] = {
                      ...newRows[idx],
                      unitCost:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    };
                    return { ...f, ingredients: newRows };
                  })
                }
                style={{ width: 140 }}
              />
              {form.ingredients.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeIngredientRow(idx)}
                  style={{ padding: "4px 8px" }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addIngredientRow}
            style={{ marginTop: 6 }}
            disabled={ingredients.length === 0 || loading}
          >
            Add Ingredient
          </button>
          {formErrors.ingredients && (
            <div
              style={{ color: "#ff7b9c", fontSize: "0.875em", marginTop: 4 }}
            >
              {formErrors.ingredients}
            </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            type="submit"
            disabled={
              loading ||
              ingredients.length === 0 ||
              form.ingredients.length === 0
            }
          >
            Create
          </button>
        </div>
      </form>
      {error && (
        <div style={{ color: "#ff7b9c", marginBottom: 12 }}>{error}</div>
      )}
      {loading ? (
        <div>Loading…</div>
      ) : menuItems.length === 0 ? (
        <div>No menu items yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  aria-label="select all"
                  checked={
                    filteredItems.length > 0 &&
                    filteredItems.every((i) => selectedIds.has(i._id!))
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(filteredItems.map((i) => i._id!).filter(Boolean)));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </th>
              <th>Name</th>
              <th>Type</th>
              <th>Category</th>
              <th>Price</th>
              <th>Margin</th>
              <th>Ingredients</th>
              {viewArchived && <th>Archived</th>}
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const isEditing = editingId === item._id;
              return (
                <tr key={item._id || item.name}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item._id!)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked && item._id) next.add(item._id);
                          if (!e.target.checked && item._id) next.delete(item._id);
                          return next;
                        });
                      }}
                    />
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
                      item.name
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={editForm.kind || "food"}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            kind: e.target.value as "food" | "beverage",
                          })
                        }
                      >
                        <option value="food">Food</option>
                        <option value="beverage">Beverage</option>
                      </select>
                    ) : (
                      (item.kind || "food").replace(/^[a-z]/, (c) =>
                        c.toUpperCase()
                      )
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        value={editForm.category || "Uncategorized"}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
                        }
                      >
                        <option value="Uncategorized">Uncategorized</option>
                        {categories
                .filter((c) => c.kind === (editForm.kind || "food"))
                .map((c) => (
                  <option key={c._id} value={c.name}>
                    {c.name}
                    {typeof c.usageCount === "number"
                      ? ` · ${c.usageCount}`
                      : ""}
                  </option>
                ))}
                      </select>
                    ) : (
                      item.category || "Uncategorized"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={editForm.price}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            price: Number(e.target.value),
                          })
                        }
                      />
                    ) : (
                      item.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    )}
                  </td>
                  <td>
                    {(() => {
                      const { margin, cost } = computeMargin(item);
                      if (margin === null) return "—";
                      const pct = Math.round(margin * 100);
                      const color =
                        margin >= 0.6
                          ? "#4ade80"
                          : margin >= 0.35
                            ? "#fbbf24"
                            : "#ff7b9c";
                      return (
                        <span style={{ color }}>
                          {pct}%<span style={{ color: "var(--muted)" }}> (cost ${cost.toFixed(2)})</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {isEditing ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {editForm.ingredients.map((row, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                            }}
                          >
                            <select
                              value={row.ingredient}
                              onChange={(e) =>
                                setEditForm((f) => {
                                  const newRows = [...f.ingredients];
                                  newRows[idx] = {
                                    ...newRows[idx],
                                    ingredient: e.target.value,
                                  };
                                  return { ...f, ingredients: newRows };
                                })
                              }
                            >
                              {ingredients.map((ing) => (
                                <option key={ing._id} value={ing._id}>
                                  {ing.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.quantity}
                              onChange={(e) =>
                                setEditForm((f) => {
                                  const newRows = [...f.ingredients];
                                  newRows[idx] = {
                                    ...newRows[idx],
                                    quantity: Number(e.target.value),
                                  };
                                  return { ...f, ingredients: newRows };
                                })
                              }
                              style={{ width: 100 }}
                            />
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Unit cost"
                              value={row.unitCost ?? ""}
                              onChange={(e) =>
                                setEditForm((f) => {
                                  const newRows = [...f.ingredients];
                                  newRows[idx] = {
                                    ...newRows[idx],
                                    unitCost:
                                      e.target.value === ""
                                        ? undefined
                                        : Number(e.target.value),
                                  };
                                  return { ...f, ingredients: newRows };
                                })
                              }
                              style={{ width: 120 }}
                            />
                            {editForm.ingredients.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEditIngredientRow(idx)}
                                style={{ padding: "4px 8px" }}
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addEditIngredientRow}
                          disabled={ingredients.length === 0}
                        >
                          Add Ingredient
                        </button>
                      </div>
                    ) : (
                      <span>
                        {item.ingredients
                          .map(
                            (ing) =>
                              `${
                                (ing as any).ingredient.name ||
                                (ing as any).ingredient
                              } × ${ing.quantity}`
                          )
                          .join(", ")}
                      </span>
                    )}
                  </td>
                  {viewArchived && (
                    <td>
                      {item.deletedAt
                        ? new Date(item.deletedAt).toLocaleDateString()
                        : "—"}
                    </td>
                  )}
                  <td>
                    {viewArchived ? (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button type="button" onClick={() => restoreMenuItem(item._id!)}>
                          Restore
                        </button>
                      </div>
                    ) : isEditing ? (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button
                          type="button"
                          onClick={() => saveEdit(item._id!)}
                        >
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <button type="button" onClick={() => startEdit(item)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteMenuItem(item._id!)}
                        >
                          Delete
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
      <h3 style={{ margin: 0 }}>{value}</h3>
      {hint && (
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
