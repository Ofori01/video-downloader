"use client";

import type { ReactNode } from "react";
import { ArrowDownToLine, Clock3, LoaderCircle, XCircle } from "lucide-react";

import type { FileStatus, JobViewModel } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface DownloadsPanelProps {
  jobs: JobViewModel[];
  statusError: string | null;
  isSyncing: boolean;
  onDownload: (jobId: string) => void;
}

const STATUS_LABEL: Record<FileStatus, string> = {
  queued: "Waiting",
  processing: "Preparing",
  ready: "Ready",
  failed: "Needs attention",
  deleted: "Expired",
};

const STATUS_ICON: Record<FileStatus, ReactNode> = {
  queued: <Clock3 className="size-3.5" aria-hidden="true" />,
  processing: (
    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
  ),
  ready: <ArrowDownToLine className="size-3.5" aria-hidden="true" />,
  failed: <XCircle className="size-3.5" aria-hidden="true" />,
  deleted: <XCircle className="size-3.5" aria-hidden="true" />,
};

export function DownloadsPanel({
  jobs,
  statusError,
  isSyncing,
  onDownload,
}: DownloadsPanelProps) {
  return (
    <section className="bg-white px-5 py-16 sm:px-8">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
              Downloads
            </p>
            <h2 className="font-heading text-[length:var(--text-heading-sm)] font-semibold leading-[var(--leading-heading-sm)] tracking-[var(--tracking-heading-sm)] text-carbon">
              Your files
            </h2>
          </div>
          {isSyncing ? (
            <p className="text-[length:var(--text-caption)] leading-[var(--leading-caption)] tracking-[var(--tracking-caption)] text-ash">
              Updating...
            </p>
          ) : null}
        </div>

        {statusError ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-[#f2b8b5] bg-[#fff1f0] px-[var(--spacing-16)] py-[var(--spacing-12)] text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-[#b42318]"
          >
            We could not refresh your downloads. Try again shortly.
          </p>
        ) : null}

        {jobs.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border bg-frost px-6 py-10 text-center">
            <p className="mx-auto max-w-[480px] text-[length:var(--text-body)] leading-[var(--leading-body)] tracking-[var(--tracking-body)] text-ash">
              Your download appears here after you start.
            </p>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-border border-y border-border">
            {jobs.map((job) => (
              <li
                key={job.id}
                className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[length:var(--text-body)] font-semibold leading-[var(--leading-body)] tracking-[var(--tracking-body)] text-carbon">
                      {job.title}
                    </p>
                    <Badge
                      variant={job.status === "deleted" ? "failed" : job.status}
                    >
                      {STATUS_ICON[job.status]}
                      {STATUS_LABEL[job.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
                    {job.errorReason || job.eta}
                  </p>
                </div>

                {job.status === "ready" ? (
                  <Button size="sm" onClick={() => onDownload(job.id)}>
                    <ArrowDownToLine className="size-4" />
                    Download
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
