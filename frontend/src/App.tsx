import { useEffect, useState } from "react";

type Status = "loading" | "up" | "down";

export default function App() {
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

  if (status === "loading") return <h1>Checking API…</h1>;
  if (status === "down")
    return <h1 style={{ color: "red" }}>API unreachable</h1>;

  return <h1>API healthy @ {time}</h1>;
}
