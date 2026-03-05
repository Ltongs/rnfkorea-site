import React from "react";
import ReactDOM from "react-dom/client";
import App from "../App";         // ✅ 루트의 App.tsx를 가리킴
import "./index.css";             // ✅ src/index.css

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find root element to mount to");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);