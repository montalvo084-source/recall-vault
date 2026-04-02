import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// window.storage — backed by the /api/data endpoint (same data on every device)
window.storage = {
  get: async (_key) => {
    const res = await fetch("/api/data");
    if (!res.ok) return null;
    return res.json();
  },
  set: async (_key, value) => {
    await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  },
  delete: async (_key) => {},
  list: async (_prefix) => [],
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
