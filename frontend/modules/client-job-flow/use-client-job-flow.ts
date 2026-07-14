"use client";

import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { normalizeError } from "@/api/error";
import { notify } from "@/lib/notify";
import type {
  AvailableProfile,
  JobViewModel,
  VideoJobCreateRequest,
  VideoJobCreateResponse,
} from "@/types";
import {
  isValidSourceUrl,
  normalizeSourceUrl,
  shouldPollJobStatus,
  sortProfilesForSelection,
  toJobViewModel,
  toOptimisticVideoFile,
} from "./job-flow-model";
import { rememberJobFileId, useStoredJobFileIds } from "./job-id-store";
import { videoJobClient } from "./video-job-client";

interface JobStatusesState {
  viewModels: JobViewModel[];
  isFetching: boolean;
  firstError: unknown;
}

interface ClientJobFlow {
  url: string;
  setUrl: (url: string) => void;
  submitted: boolean;
  isUrlValid: boolean;
  selectedProfileId: string | null;
  selectProfile: (profileId: string) => void;
  profileOptions: AvailableProfile[];
  isLoadingProfiles: boolean;
  profileError: Error | null;
  canSubmit: boolean;
  isSubmitting: boolean;
  submit: () => Promise<void>;
  jobItems: JobViewModel[];
  isFetchingStatuses: boolean;
  statusError: unknown;
  getSignedDownloadUrl: (fileId: string) => Promise<string>;
}

function useProfileOptionsQuery(url: string | null) {
  return useQuery<AvailableProfile[], Error>({
    queryKey: ["availableProfiles", url],
    queryFn: async ({ signal }) => {
      if (!url) {
        return [];
      }

      return videoJobClient.getProfiles(url, { signal });
    },
    enabled: Boolean(url),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

function useJobSubmissionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: videoJobClient.createJob,
    onSuccess: (
      data: VideoJobCreateResponse,
      variables: VideoJobCreateRequest,
    ) => {
      queryClient.setQueryData(
        ["video-file", data.fileId],
        toOptimisticVideoFile(data, variables),
      );
      notify.success("Download started.");
    },
    onError: (error: unknown) => {
      const normalized = normalizeError(error);
      if (normalized.message !== "Request was cancelled.") {
        notify.error(normalized.message);
      }
    },
  });
}

function useStoredJobStatusQueries(fileIds: string[]): JobStatusesState {
  const uniqueFileIds = Array.from(new Set(fileIds));

  const queries = useQueries({
    queries: uniqueFileIds.map((fileId) => ({
      queryKey: ["video-file", fileId],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        videoJobClient.getFileStatus(fileId, { signal }),
      enabled: fileId.length > 0,
      retry: (failureCount: number, error: unknown) => {
        const normalized = normalizeError(error);
        return normalized.isRetryable && failureCount < 2;
      },
      refetchInterval: (query: { state: { data?: { status?: string } } }) => {
        const status = query.state.data?.status;
        return shouldPollJobStatus(status) ? 5000 : false;
      },
      staleTime: 0,
    })),
  });

  const items = queries
    .map((query) => query.data)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return {
    viewModels: items.map(toJobViewModel),
    isFetching: queries.some((query) => query.isFetching),
    firstError: queries.find((query) => query.error)?.error,
  };
}

export function useClientJobFlow(): ClientJobFlow {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const fileIds = useStoredJobFileIds();
  const createJobMutation = useJobSubmissionMutation();
  const jobStatuses = useStoredJobStatusQueries(fileIds);
  const normalizedUrl = useMemo(() => normalizeSourceUrl(url), [url]);
  const isUrlValid = useMemo(
    () => isValidSourceUrl(normalizedUrl),
    [normalizedUrl],
  );
  const profilesQuery = useProfileOptionsQuery(
    isUrlValid ? normalizedUrl : null,
  );
  const profileOptions = useMemo(
    () => sortProfilesForSelection(profilesQuery.data ?? []),
    [profilesQuery.data],
  );
  const hasSelectedProfile = Boolean(
    selectedProfileId &&
    profileOptions.some((profile) => profile.id === selectedProfileId),
  );

  function updateUrl(nextUrl: string): void {
    setUrl(nextUrl);
    setSelectedProfileId(null);
  }

  function selectProfile(profileId: string): void {
    setSelectedProfileId(profileId);
  }

  async function submit(): Promise<void> {
    setSubmitted(true);

    if (!isUrlValid || !selectedProfileId || !hasSelectedProfile) {
      return;
    }

    try {
      const result = await createJobMutation.mutateAsync({
        url: normalizedUrl,
        profileId: selectedProfileId,
      });
      rememberJobFileId(result.fileId);
      setUrl("");
      setSelectedProfileId(null);
      setSubmitted(false);
    } catch {
      // Error is surfaced through mutation state and toast handling.
    }
  }

  return {
    url,
    setUrl: updateUrl,
    submitted,
    isUrlValid,
    selectedProfileId,
    selectProfile,
    profileOptions,
    isLoadingProfiles: profilesQuery.isLoading,
    profileError: profilesQuery.error,
    canSubmit: isUrlValid && hasSelectedProfile && !createJobMutation.isPending,
    isSubmitting: createJobMutation.isPending,
    submit,
    jobItems: jobStatuses.viewModels,
    isFetchingStatuses: jobStatuses.isFetching,
    statusError: jobStatuses.firstError,
    getSignedDownloadUrl: videoJobClient.getSignedDownloadUrl,
  };
}
