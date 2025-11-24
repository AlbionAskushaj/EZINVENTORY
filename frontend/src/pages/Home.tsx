export default function Home() {
  const valueByCategory = [
    { label: "Produce", value: 4820, change: 6.2 },
    { label: "Meat & Seafood", value: 6125, change: -3.1 },
    { label: "Dairy", value: 1890, change: 2.4 },
    { label: "Dry Goods", value: 3250, change: 1.1 },
  ];

  const tiedUpSkus = [
    { sku: "BF-2145", name: "Striploin AAA (12oz)", value: 1820, onHand: 65 },
    { sku: "VG-8821", name: "Avocado Hass 48ct", value: 740, onHand: 42 },
    { sku: "DR-4100", name: "Parmesan Reggiano Wheel", value: 690, onHand: 18 },
    { sku: "BR-1120", name: "House Brioche Buns", value: 520, onHand: 210 },
  ];

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

      <div
        className="card"
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
        }}
      >
        <div className="card" style={{ background: "rgba(255,255,255,0.03)" }}>
          <p style={{ color: "var(--muted)", marginBottom: 4 }}>
            Weekly Food Cost %
          </p>
          <h2 style={{ marginBottom: 4 }}>29.4%</h2>
          <p style={{ color: "var(--muted)", marginBottom: 8 }}>
            Target: 28–32% • Trend: stable
          </p>
          <small style={{ color: "var(--muted)" }}>
            Uses demo values; hook to sales + COGS to make live.
          </small>
        </div>
        <div className="card" style={{ background: "rgba(124,92,255,0.08)" }}>
          <p style={{ color: "var(--muted)", marginBottom: 4 }}>
            Inventory Value On Hand
          </p>
          <h2 style={{ marginBottom: 4 }}>$16,085</h2>
          <p style={{ color: "var(--muted)", marginBottom: 8 }}>
            Next truck: Wed • Consider pulling down meats.
          </p>
          <small style={{ color: "var(--muted)" }}>
            Based on illustrative SKU values below.
          </small>
        </div>
        <div className="card" style={{ background: "rgba(0,229,255,0.06)" }}>
          <p style={{ color: "var(--muted)", marginBottom: 4 }}>
            Cash Tied Up (7d)
          </p>
          <h2 style={{ marginBottom: 4 }}>$9,740</h2>
          <p style={{ color: "var(--muted)", marginBottom: 8 }}>
            Largest PO: $3,250 (Dry) • Avg payment: 21 days.
          </p>
          <small style={{ color: "var(--muted)" }}>
            Replace with AP feed or uploads when available.
          </small>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h3 style={{ margin: 0 }}>Where Money Sits (by category)</h3>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>Demo</span>
          </div>
          <div className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
            {valueByCategory.map((row) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{row.label}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    On hand value
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div>${row.value.toLocaleString()}</div>
                  <div
                    style={{
                      color: row.change >= 0 ? "#4ade80" : "#ff7b9c",
                      fontSize: 12,
                    }}
                  >
                    {row.change > 0 ? "+" : ""}
                    {row.change}% vs last week
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h3 style={{ margin: 0 }}>Top SKUs by value</h3>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>Demo</span>
          </div>
          <div className="card" style={{ background: "rgba(255,255,255,0.02)" }}>
            {tiedUpSkus.map((row) => (
              <div
                key={row.sku}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 8,
                  padding: "10px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{row.name}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    {row.sku} • {row.onHand} on hand
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 600 }}>
                    ${row.value.toLocaleString()}
                  </div>
                  <div style={{ color: "var(--muted)", fontSize: 12 }}>
                    Consider reducing PAR if slow
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
