import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { NuqsAdapter } from "nuqs/adapters/react";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <NuqsAdapter>
      <React.StrictMode>
        <RouterProvider router={router} />
        <Toaster position="top-center" />
      </React.StrictMode>
    </NuqsAdapter>
  </QueryClientProvider>
);
