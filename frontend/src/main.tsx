import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { LanguageProvider } from "./i18n";
import "./index.css";
import "./styles/tokens.css";

const qc = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <LanguageProvider>
        {/* App picks the right router: public site at "/", console under "/console". */}
        <App />
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
