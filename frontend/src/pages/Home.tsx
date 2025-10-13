export default function Home() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <img
          src="/EZInventory.png"
          alt="EZInventory"
          width={80}
          height={80}
          style={{ objectFit: "contain" }}
        />
        <h1 style={{ fontSize: 36, letterSpacing: 0.5, margin: 0 }}>
          EZInventory
        </h1>
      </div>
      <p style={{ maxWidth: 720, color: "var(--muted)", marginBottom: 16 }}>
        Manage stock with linked units and ingredients, track current quantities
        against target par levels, and adjust inventory with reasoned movements.
        Create restaurant accounts, authenticate securely, and keep data scoped
        per restaurant. Coming next: menu items with recipes and sales import to
        compute expected usage and variance. - Created by Albion Askushaj
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
            Track items, par levels, current qty, and adjustments.
          </p>
        </div>
      </div>
    </div>
  );
}
