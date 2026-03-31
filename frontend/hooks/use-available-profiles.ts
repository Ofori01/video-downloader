import { useQuery } from "@tanstack/react-query";
import { videoApi } from "@/api/video.api";
import type { AvailableProfile } from "@/types";

export function useAvailableProfiles(url: string | null) {
  return useQuery<AvailableProfile[], Error>({
    queryKey: ["availableProfiles", url],
    queryFn: async ({ signal }) => {
      if (!url) return [];
      return videoApi.getProfiles(url, { signal });
    },
    enabled: !!url,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}
