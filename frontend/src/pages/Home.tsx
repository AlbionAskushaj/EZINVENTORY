export default function Home() {
  return (
    <div>
      <h1 style={{ fontSize: 36, letterSpacing: 0.5, marginBottom: 8 }}>
        EZInventory
      </h1>
      <p style={{ maxWidth: 720, color: "var(--muted)", marginBottom: 16 }}>
        A sleek, futuristic inventory system. Manage units and ingredients with
        ease. This interface uses a neon glass theme for a modern feel.
      </p>
      <div
        className="card"
        style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
      >
        <div className="card" style={{ flex: 1, minWidth: 240 }}>
          <h3>Health</h3>
          <p style={{ color: "var(--muted)" }}>Check backend connectivity.</p>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 240 }}>
          <h3>Units</h3>
          <p style={{ color: "var(--muted)" }}>
            Create and manage measurement units.
          </p>
        </div>
        <div className="card" style={{ flex: 1, minWidth: 240 }}>
          <h3>Ingredients</h3>
          <p style={{ color: "var(--muted)" }}>
            Track items and their base units.
          </p>
        </div>
      </div>
    </div>
  );
}
