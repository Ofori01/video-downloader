"use client";

import { Check } from "lucide-react";

import type { AvailableProfile } from "@/types";
import { cn } from "@/lib/utils";

interface FormatOptionsProps {
  profiles: AvailableProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  isLoading: boolean;
  error: Error | null;
}

export function FormatOptions({
  profiles,
  selectedProfileId,
  onSelectProfile,
  isLoading,
  error,
}: FormatOptionsProps) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-[#f2b8b5] bg-[#fff1f0] px-[var(--spacing-16)] py-[var(--spacing-12)] text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-[#b42318]"
      >
        This link did not return download options. Try another link.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3" aria-label="Loading download options">
        <p className="text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
          Finding download options...
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[72px] animate-pulse rounded-lg border border-border bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-white px-[var(--spacing-16)] py-[var(--spacing-12)] text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
        No download options were found for this link.
      </p>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="text-[length:var(--text-body-sm)] leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-ash">
        Choose a quality
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {profiles.slice(0, 6).map((profile) => {
          const selected = selectedProfileId === profile.id;

          return (
            <label
              key={profile.id}
              className={cn(
                "flex min-h-[88px] cursor-pointer flex-col justify-between rounded-lg border bg-white px-[var(--spacing-16)] py-[var(--spacing-12)] text-left transition-[border-color,background-color,transform] duration-150 ease-out active:scale-[0.99]",
                selected
                  ? "border-apple-blue bg-ice"
                  : "border-border hover:border-mist hover:bg-frost",
              )}
            >
              <span className="flex items-start justify-between gap-3">
                <span>
                  <span className="block text-[length:var(--text-body-sm)] font-semibold leading-[var(--leading-body-sm)] tracking-[var(--tracking-body-sm)] text-carbon">
                    {profile.label}
                  </span>
                  <span className="mt-1 block text-[length:var(--text-caption)] leading-[var(--leading-caption)] tracking-[var(--tracking-caption)] text-ash">
                    {formatProfileMeta(profile)}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 grid size-5 place-items-center rounded-full border",
                    selected
                      ? "border-apple-blue bg-apple-blue text-white"
                      : "border-border text-transparent",
                  )}
                  aria-hidden="true"
                >
                  <Check className="size-3" />
                </span>
              </span>
              <input
                type="radio"
                name="download-format"
                value={profile.id}
                checked={selected}
                onChange={() => onSelectProfile(profile.id)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function formatProfileMeta(profile: AvailableProfile): string {
  const size = formatBytes(profile.estimatedSize);
  const extension = profile.ext.toUpperCase();
  if (profile.isAudioOnly) {
    return compactParts(["Audio", extension, size]).join(" · ");
  }

  const resolution = profile.resolution ? `${profile.resolution}` : "Video";
  const audioState = profile.hasAudio ? null : "Video only";
  return compactParts([resolution, audioState, extension, size]).join(" · ");
}

function compactParts(parts: Array<string | null | undefined>): string[] {
  return parts.filter((part): part is string => Boolean(part));
}

function formatBytes(bytes: number | undefined): string | null {
  if (!bytes) {
    return null;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
