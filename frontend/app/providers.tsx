"use client";

import { useState, type PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

import { useConnectivityFeedback } from "@/hooks/use-connectivity-feedback";
import { createQueryClient } from "@/lib/query/query-client";

function ConnectivityObserver() {
  useConnectivityFeedback();
  return null;
}

export function Providers({ children }: PropsWithChildren) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectivityObserver />
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            border: "1px solid var(--border)",
            background: "var(--surface)",
            color: "var(--foreground)",
            boxShadow: "var(--shadow-md)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
