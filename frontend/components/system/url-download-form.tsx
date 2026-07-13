"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";

import type { AvailableProfile } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormatOptions } from "@/components/system/format-options";

interface UrlDownloadFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  submitted: boolean;
  isUrlValid: boolean;
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  profiles: AvailableProfile[];
  isLoadingProfiles: boolean;
  profileError: Error | null;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => Promise<void>;
}

export function UrlDownloadForm({
  url,
  onUrlChange,
  submitted,
  isUrlValid,
  selectedProfileId,
  onSelectProfile,
  profiles,
  isLoadingProfiles,
  profileError,
  canSubmit,
  isSubmitting,
  onSubmit,
}: UrlDownloadFormProps) {
  return (
    <form
      className="mx-auto mt-10 w-full max-w-[920px] space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit();
      }}
    >
      <div className="grid gap-3 rounded-lg border border-border bg-white p-2 sm:grid-cols-[1fr_auto]">
        <label className="sr-only" htmlFor="video-url">
          Video link
        </label>
        <Input
          id="video-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="Paste a video link"
          aria-invalid={submitted && !isUrlValid}
          aria-describedby="video-url-message"
          className="border-transparent bg-transparent focus-visible:border-transparent focus-visible:ring-0"
        />
        <Button
          type="submit"
          disabled={!canSubmit}
          className="h-[52px] px-6"
          suppressHydrationWarning
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Starting
            </>
          ) : (
            <>
              Start
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>

      <div id="video-url-message" aria-live="polite">
        {submitted && !isUrlValid ? (
          <p
            role="alert"
            className="text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-[#b42318]"
          >
            Enter a valid link that starts with http:// or https://.
          </p>
        ) : (
          <p className="text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
            Paste a link, choose a quality, then start the download.
          </p>
        )}
      </div>

      {isUrlValid ? (
        <FormatOptions
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          onSelectProfile={onSelectProfile}
          isLoading={isLoadingProfiles}
          error={profileError}
        />
      ) : null}

      {submitted && isUrlValid && !selectedProfileId ? (
        <p
          role="alert"
          className="rounded-lg border border-[#f4c26b] bg-[#fff7e6] px-[var(--spacing-16)] py-[var(--spacing-12)] text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-[#7a4d00]"
        >
          Choose a quality to continue.
        </p>
      ) : null}
    </form>
  );
}
