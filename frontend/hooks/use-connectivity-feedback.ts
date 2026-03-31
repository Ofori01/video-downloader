"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { notify } from "@/lib/notify";

export function useConnectivityFeedback() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleOffline = () => {
      notify.networkOffline();
    };

    const handleOnline = () => {
      notify.networkOnline();
      void queryClient.invalidateQueries({ queryKey: ["video-file"] });
      void queryClient.invalidateQueries({ queryKey: ["health-status"] });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [queryClient]);
}
