import { useEffect, useState } from "react";

type Status = "loading" | "up" | "down";

export default function HealthPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const url = `${import.meta.env.VITE_API_URL}/api/health`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setStatus("up");
        setTime(data.time);
      })
      .catch(() => setStatus("down"));
  }, []);

  if (status === "loading") return <h2>Checking API…</h2>;
  if (status === "down")
    return <h2 style={{ color: "#ff7b9c" }}>API unreachable</h2>;

  return <h2>API healthy @ {time}</h2>;
}
