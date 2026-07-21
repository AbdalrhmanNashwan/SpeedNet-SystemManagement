import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import { LanguageProvider } from "./i18n";
import "./index.css";
import "./styles/tokens.css";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Treat data as fresh for 30s so navigating back to a page you just
      // viewed renders instantly from cache instead of showing a spinner.
      staleTime: 30_000,
      // Keep unused data around for 10 min before dropping it, so revisits
      // within that window are served from cache (with a quiet background refresh).
      gcTime: 10 * 60_000,
      // Refetching on every window focus is noisy; the alert feed already polls.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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
