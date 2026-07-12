"use client";

import type { ReactNode } from "react";
import {
  ArrowRight,
  Download,
  Hourglass,
  Link2,
  LoaderCircle,
} from "lucide-react";

import { getErrorMessage } from "@/api/error";
import { useHealthStatus } from "@/hooks/use-health-status";
import { useClientJobFlow } from "@/modules/client-job-flow";
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

const STATUS_ICON: Record<FileStatus, ReactNode> = {
  queued: <Hourglass className="size-4" aria-hidden="true" />,
  processing: (
    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
  ),
  ready: <Download className="size-4" aria-hidden="true" />,
  failed: <ArrowRight className="size-4" aria-hidden="true" />,
  deleted: <ArrowRight className="size-4" aria-hidden="true" />,
};

export function HomeShell() {
  const jobFlow = useClientJobFlow();
  const healthQuery = useHealthStatus();
  const statusError = jobFlow.statusError
    ? getErrorMessage(jobFlow.statusError)
    : null;

  const jobItems = jobFlow.jobItems;

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
                await jobFlow.submit();
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
                    value={jobFlow.url}
                    onChange={(event) => jobFlow.setUrl(event.target.value)}
                    placeholder="https://example.com/video"
                    aria-invalid={jobFlow.submitted && !jobFlow.isUrlValid}
                    aria-describedby="video-url-help"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  disabled={!jobFlow.canSubmit}
                  className="sm:w-auto"
                  suppressHydrationWarning
                >
                  {jobFlow.isSubmitting ? "Submitting..." : "Start Download"}
                </Button>
              </div>
              <p
                id="video-url-help"
                className="text-[length:var(--text-caption)] text-[var(--foreground-muted)]"
              >
                Supports public video links. Maximum file size and session
                limits apply.
              </p>
              {jobFlow.submitted && !jobFlow.isUrlValid ? (
                <p
                  role="alert"
                  className="rounded-[var(--radius-md)] border border-rose-200 bg-rose-50 px-3 py-2 text-[length:var(--text-body-sm)] text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                >
                  Enter a valid URL starting with http:// or https://.
                </p>
              ) : null}
              {jobFlow.isUrlValid && (
                <div className="rounded-[var(--radius-md)] border border-[var(--border)] p-4">
                  <ProfileSelector
                    profiles={jobFlow.profileOptions}
                    selectedProfileId={jobFlow.selectedProfileId}
                    onSelectProfile={jobFlow.selectProfile}
                    isLoading={jobFlow.isLoadingProfiles}
                    error={jobFlow.profileError}
                  />
                </div>
              )}
              {jobFlow.submitted &&
              !jobFlow.selectedProfileId &&
              jobFlow.isUrlValid ? (
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
                              jobFlow.getDownloadUrl(job.id),
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
            {jobFlow.isFetchingStatuses ? (
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
