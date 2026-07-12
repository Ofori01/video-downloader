"use client";

import { getErrorMessage } from "@/api/error";
import { ServiceStatusPill } from "@/components/system/service-status-pill";
import { UrlDownloadForm } from "@/components/system/url-download-form";
import { DownloadsPanel } from "@/components/system/downloads-panel";
import { useHealthStatus } from "@/hooks/use-health-status";
import { useClientJobFlow } from "@/modules/client-job-flow";

export function HomeShell() {
  const jobFlow = useClientJobFlow();
  const healthQuery = useHealthStatus();
  const statusError = jobFlow.statusError
    ? getErrorMessage(jobFlow.statusError)
    : null;

  function handleDownload(jobId: string): void {
    window.open(
      jobFlow.getDownloadUrl(jobId),
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <main className="min-h-dvh bg-frost text-carbon">
      <section className="px-5 py-16 sm:px-8 lg:py-24">
        <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-[980px] flex-col items-center justify-center text-center">
          <ServiceStatusPill
            health={healthQuery.data}
            hasError={Boolean(healthQuery.error)}
          />

          <p className="mt-10 text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
            Video Downloader
          </p>
          <h1 className="mt-3 font-heading text-[length:var(--text-heading-lg)] font-semibold leading-[var(--leading-heading-lg)] tracking-[var(--tracking-heading-lg)] text-carbon sm:text-[length:var(--text-display)] sm:leading-[var(--leading-display)] sm:tracking-[var(--tracking-display)]">
            Paste. Choose. Download.
          </h1>
          <p className="mt-4 max-w-[560px] text-[length:var(--text-subheading)] font-light leading-[var(--leading-subheading)] tracking-[var(--tracking-subheading)] text-smoke">
            Save a video in the format you want. No account needed.
          </p>

          <UrlDownloadForm
            url={jobFlow.url}
            onUrlChange={jobFlow.setUrl}
            submitted={jobFlow.submitted}
            isUrlValid={jobFlow.isUrlValid}
            selectedProfileId={jobFlow.selectedProfileId}
            onSelectProfile={jobFlow.selectProfile}
            profiles={jobFlow.profileOptions}
            isLoadingProfiles={jobFlow.isLoadingProfiles}
            profileError={jobFlow.profileError}
            canSubmit={jobFlow.canSubmit}
            isSubmitting={jobFlow.isSubmitting}
            onSubmit={jobFlow.submit}
          />
        </div>
      </section>

      <DownloadsPanel
        jobs={jobFlow.jobItems}
        statusError={statusError}
        isSyncing={jobFlow.isFetchingStatuses}
        onDownload={handleDownload}
      />
    </main>
  );
}
