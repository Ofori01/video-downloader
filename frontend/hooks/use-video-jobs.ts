"use client";

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { normalizeError } from "@/api/error";
import { notify } from "@/lib/notify";
import { videoService } from "@/services/video.service";
import type {
  VideoFile,
  VideoJobCreateRequest,
  VideoJobCreateResponse,
} from "@/types";

function shouldPoll(status: string | undefined): boolean {
  return status === "queued" || status === "processing";
}

export function useCreateVideoJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: videoService.createJob,
    onSuccess: (
      data: VideoJobCreateResponse,
      variables: VideoJobCreateRequest,
    ) => {
      const optimisticFile: VideoFile = {
        id: data.fileId,
        key: `pending/${data.fileId}`,
        sourceUrl: variables.url,
        size: String(data.estimatedSize),
        status: data.status,
        sessionId: "current-session",
        profileId: variables.profileId ?? null,
        createdAt: new Date().toISOString(),
        downloadedAt: null,
        expiresAt: null,
        queueJobId: data.jobId,
        errorReason: null,
      };

      queryClient.setQueryData(["video-file", data.fileId], optimisticFile);
      notify.success("Download job submitted.");
    },
    onError: (error: unknown) => {
      const normalized = normalizeError(error);
      if (normalized.message !== "Request was cancelled.") {
        notify.error(normalized.message);
      }
    },
  });
}

export function useVideoJobStatuses(fileIds: string[]) {
  const uniqueFileIds = Array.from(new Set(fileIds));

  const queries = useQueries({
    queries: uniqueFileIds.map((fileId) => ({
      queryKey: ["video-file", fileId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        videoService.getFileStatus(fileId, { signal }),
      enabled: fileId.length > 0,
      retry: (failureCount: number, error: unknown) => {
        const normalized = normalizeError(error);
        return normalized.isRetryable && failureCount < 2;
      },
      refetchInterval: (query: { state: { data?: { status?: string } } }) => {
        const status = query.state.data?.status;
        return shouldPoll(status) ? 5000 : false;
      },
      staleTime: 0,
    })),
  });

  const items = queries
    .map((query) => query.data)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return {
    items,
    isLoading: queries.some((query) => query.isLoading),
    isFetching: queries.some((query) => query.isFetching),
    hasError: queries.some((query) => query.isError),
    firstError: queries.find((query) => query.error)?.error,
  };
}
