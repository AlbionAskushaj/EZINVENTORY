import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";

type Ingredient = {
  _id: string;
  name: string;
};

type MenuItemIngredient = {
  ingredient: string;
  quantity: number;
};

type MenuItem = {
  _id?: string;
  name: string;
  price: number;
  kind?: "food" | "beverage";
  category?: string;
  ingredients: MenuItemIngredient[];
};

export default function MenuPage() {
  const { token } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
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

  const menuUrl = `${import.meta.env.VITE_API_URL}/api/menu`;
  const ingredientsUrl = `${import.meta.env.VITE_API_URL}/api/ingredients`;

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [menuRes, ingRes] = await Promise.all([
        fetch(menuUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${ingredientsUrl}?active=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [menuData, ingData] = await Promise.all([
        menuRes.json(),
        ingRes.json(),
      ]);
      setMenuItems(menuData);
      // simplify ingredient objects
      setIngredients(ingData.map((i: any) => ({ _id: i._id, name: i.name })));
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
  }, [token]);

  useEffect(() => {
    try {
      const prefill = sessionStorage.getItem("ezinv.menu.prefill");
      if (prefill) {
        setForm((f) => ({ ...f, name: prefill }));
        sessionStorage.removeItem("ezinv.menu.prefill");
      }
    } catch {
      /* ignore */
    }
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
    try {
      const res = await fetch(`${menuUrl}/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed: ${res.status}`);
      }
      await loadData();
    } catch (e: any) {
      setError(e.message ?? "Failed to delete");
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Menu Items</h2>
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
            <input
              id="menu-category"
              placeholder="e.g., Red Wine, Starters"
              value={form.category || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            />
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
              <th>Name</th>
              <th>Type</th>
              <th>Category</th>
              <th>Price</th>
              <th>Ingredients</th>
              <th style={{ width: 220 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => {
              const isEditing = editingId === item._id;
              return (
                <tr key={item._id || item.name}>
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
                      <input
                        value={editForm.category || ""}
                        onChange={(e) =>
                          setEditForm((f) => ({
                            ...f,
                            category: e.target.value,
                          }))
                        }
                      />
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
                  <td>
                    {isEditing ? (
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
