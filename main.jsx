import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// window.storage polyfill for local dev (backed by localStorage)
if (!window.storage) {
  window.storage = {
    get: async (key) => {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    },
    set: async (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    delete: async (key) => {
      localStorage.removeItem(key);
    },
    list: async (prefix) => {
      return Object.keys(localStorage).filter((k) => k.startsWith(prefix));
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
