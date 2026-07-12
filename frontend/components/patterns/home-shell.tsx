"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  Download,
  Hourglass,
  Link2,
  LoaderCircle,
} from "lucide-react";

import { getErrorMessage } from "@/api/error";
import { useHealthStatus } from "@/hooks/use-health-status";
import { useAvailableProfiles } from "@/hooks/use-available-profiles";
import { useCreateVideoJob, useVideoJobStatuses } from "@/hooks/use-video-jobs";
import { normalizeSourceUrl, videoService } from "@/services/video.service";
import type { FileStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ProfileSelector } from "@/components/patterns/profile-selector";

const STATUS_LABEL: Record<FileStatus, string> = {
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
  deleted: "Deleted",
};

const STATUS_ICON: Record<FileStatus, React.ReactNode> = {
  queued: <Hourglass className="size-4" aria-hidden="true" />,
  processing: (
    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
  ),
  ready: <Download className="size-4" aria-hidden="true" />,
  failed: <ArrowRight className="size-4" aria-hidden="true" />,
  deleted: <ArrowRight className="size-4" aria-hidden="true" />,
};

const JOB_IDS_STORAGE_KEY = "video-downloader:job-file-ids";
const JOB_IDS_STORAGE_EVENT = "video-downloader:job-file-ids-change";
const MAX_STORED_JOB_IDS = 100;
const EMPTY_JOB_IDS: string[] = [];

let cachedJobIdsRaw: string | null | undefined;
let cachedJobIdsSnapshot: string[] = EMPTY_JOB_IDS;

function parseStoredJobIds(raw: string | null): string[] {
  if (!raw) {
    return EMPTY_JOB_IDS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return EMPTY_JOB_IDS;
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .slice(0, MAX_STORED_JOB_IDS);
  } catch {
    return EMPTY_JOB_IDS;
  }
}

function readStoredJobIds(): string[] {
  if (typeof window === "undefined") {
    return EMPTY_JOB_IDS;
  }

  const raw = window.localStorage.getItem(JOB_IDS_STORAGE_KEY);
  if (raw === cachedJobIdsRaw) {
    return cachedJobIdsSnapshot;
  }

  cachedJobIdsRaw = raw;
  cachedJobIdsSnapshot = parseStoredJobIds(raw);
  return cachedJobIdsSnapshot;
}

function saveStoredJobIds(fileIds: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const nextSnapshot = fileIds.slice(0, MAX_STORED_JOB_IDS);
  const nextRaw = JSON.stringify(nextSnapshot);
  if (nextRaw === cachedJobIdsRaw) {
    return;
  }

  cachedJobIdsRaw = nextRaw;
  cachedJobIdsSnapshot = nextSnapshot;
  window.localStorage.setItem(JOB_IDS_STORAGE_KEY, nextRaw);

  window.dispatchEvent(new Event(JOB_IDS_STORAGE_EVENT));
}

function subscribeStoredJobIds(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === JOB_IDS_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(JOB_IDS_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(JOB_IDS_STORAGE_EVENT, onStoreChange);
  };
}

function getStoredJobIdsServerSnapshot(): string[] {
  return EMPTY_JOB_IDS;
}

export function HomeShell() {
  const [url, setUrl] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const fileIds = useSyncExternalStore(
    subscribeStoredJobIds,
    readStoredJobIds,
    getStoredJobIdsServerSnapshot,
  );

  const healthQuery = useHealthStatus();
  const createJobMutation = useCreateVideoJob();
  const jobStatuses = useVideoJobStatuses(fileIds);
  const normalizedUrl = useMemo(() => normalizeSourceUrl(url), [url]);

  const isValid = useMemo(() => {
    if (!normalizedUrl) {
      return false;
    }

    try {
      const parsed = new URL(normalizedUrl);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, [normalizedUrl]);

  // Profile discovery query
  const profilesQuery = useAvailableProfiles(isValid ? normalizedUrl : null);

  const statusError = jobStatuses.firstError
    ? getErrorMessage(jobStatuses.firstError)
    : null;

  const jobItems = jobStatuses.items.map(videoService.toJobViewModel);

  const healthBadgeVariant =
    healthQuery.data?.status === "ok" ? "ready" : "queued";

  return (
    <div className="mx-auto grid w-full max-w-280 grid-cols-1 gap-6 px-4 pb-12 pt-8 sm:px-6 md:grid-cols-12 md:gap-8 md:px-8 md:pt-12">
      <section className="md:col-span-7">
        <Card className="overflow-hidden">
          <CardHeader className="gap-3 pb-3">
            <p className="text-(length:--text-label) uppercase tracking-[0.08em] text-(--foreground-muted)">
              Vibe downloader
            </p>
            <CardTitle className="text-(length:--text-h1) leading-[1.15]">
              Download videos from 100+ supported sites.
            </CardTitle>
            <CardDescription>
              Paste a supported URL and track progress in real time. Files are
              secure, temporary, and ready when processing completes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault();
                setSubmitted(true);

                if (!isValid || !selectedProfileId) {
                  return;
                }

                try {
                  const result = await createJobMutation.mutateAsync({
                    url: normalizedUrl,
                    profileId: selectedProfileId,
                  });
                  const deduped = fileIds.filter((id) => id !== result.fileId);
                  saveStoredJobIds(
                    [result.fileId, ...deduped].slice(0, MAX_STORED_JOB_IDS),
                  );
                  setUrl("");
                  setSelectedProfileId(null);
                } catch {
                  // Error is surfaced through mutation state.
                }
              }}
            >
              <label
                htmlFor="video-url"
                className="block text-[length:var(--text-label)] font-medium text-[var(--foreground)]"
              >
                Video URL
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Input
                    id="video-url"
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://example.com/video"
                    aria-invalid={submitted && !isValid}
                    aria-describedby="video-url-help"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={
                    !isValid ||
                    !selectedProfileId ||
                    createJobMutation.isPending
                  }
                  className="sm:w-auto"
                  suppressHydrationWarning
                >
                  {createJobMutation.isPending
                    ? "Submitting..."
                    : "Start Download"}
                </Button>
              </div>
              <p
                id="video-url-help"
                className="text-[length:var(--text-caption)] text-[var(--foreground-muted)]"
              >
                Supports public video links. Maximum file size and session
                limits apply.
              </p>
              {submitted && !isValid ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[length:var(--text-body-sm)] text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                >
                  Enter a valid URL starting with http:// or https://.
                </p>
              ) : null}
              {isValid && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                  <ProfileSelector
                    profiles={profilesQuery.data ?? []}
                    selectedProfileId={selectedProfileId}
                    onSelectProfile={setSelectedProfileId}
                    isLoading={profilesQuery.isLoading}
                    error={profilesQuery.error}
                  />
                </div>
              )}
              {submitted && !selectedProfileId && isValid ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 px-3 py-2 text-[length:var(--text-body-sm)] text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                >
                  Please select a download quality to continue.
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-6 md:col-span-5">
        <Card>
          <CardHeader>
            <CardTitle>System Snapshot</CardTitle>
            <CardDescription>
              Live service visibility for user-facing operations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2">
              <span className="text-[length:var(--text-body-sm)] text-[var(--foreground-muted)]">
                API
              </span>
              <Badge variant={healthBadgeVariant}>
                {healthQuery.data?.checks.postgres.status === "up"
                  ? "Operational"
                  : "Degraded"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2">
              <span className="text-[length:var(--text-body-sm)] text-[var(--foreground-muted)]">
                Queue
              </span>
              <Badge
                variant={
                  healthQuery.data?.checks.queue.status === "up"
                    ? "processing"
                    : "failed"
                }
              >
                {healthQuery.data?.checks.queue.status === "up"
                  ? "Active"
                  : "Unavailable"}
              </Badge>
            </div>
            <div className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2">
              <span className="text-[length:var(--text-body-sm)] text-[var(--foreground-muted)]">
                Storage
              </span>
              <Badge
                variant={
                  healthQuery.data?.checks.redis.status === "up"
                    ? "queued"
                    : "failed"
                }
              >
                {healthQuery.data?.checks.redis.status === "up"
                  ? "Connected"
                  : "Unavailable"}
              </Badge>
            </div>
            {healthQuery.error ? (
              <p className="text-[length:var(--text-caption)] text-rose-600 dark:text-rose-300">
                {getErrorMessage(healthQuery.error)}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </aside>

      <section className="md:col-span-12">
        <Card>
          <CardHeader>
            <CardTitle>Recent Jobs</CardTitle>
            <CardDescription>
              Track queue state and expected completion at a glance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusError ? (
              <p className="mb-3 rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[length:var(--text-body-sm)] text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                {statusError}
              </p>
            ) : null}

            {jobItems.length === 0 ? (
              <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-6 text-center">
                <p className="text-[length:var(--text-body-sm)] text-[var(--foreground-muted)]">
                  No jobs yet. Submit a URL to start your first download.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {jobItems.map((job) => (
                  <li
                    key={job.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-subtle)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[length:var(--text-body)] font-medium text-[var(--foreground)]">
                        {job.title}
                      </p>
                      <p className="text-[length:var(--text-caption)] text-[var(--foreground-muted)]">
                        Job #{job.id} · {job.eta}
                      </p>
                      {job.errorReason ? (
                        <p className="mt-1 text-[length:var(--text-caption)] text-rose-600 dark:text-rose-300">
                          {job.errorReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          job.status === "deleted" ? "failed" : job.status
                        }
                      >
                        <span className="mr-1 inline-flex">
                          {STATUS_ICON[job.status]}
                        </span>
                        {STATUS_LABEL[job.status]}
                      </Badge>
                      {job.status === "ready" ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            window.open(
                              videoService.getDownloadUrl(job.id),
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                        >
                          <Link2 className="mr-1 size-4" />
                          Download
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {jobStatuses.isFetching ? (
              <p className="mt-3 text-[length:var(--text-caption)] text-[var(--foreground-muted)]">
                Syncing latest statuses...
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
