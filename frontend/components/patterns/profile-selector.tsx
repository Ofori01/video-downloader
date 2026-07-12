"use client";

import type { AvailableProfile } from "@/types";

interface ProfileSelectorProps {
  profiles: AvailableProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
  isLoading: boolean;
  error: Error | null;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function ProfileSelector({
  profiles,
  selectedProfileId,
  onSelectProfile,
  isLoading,
  error,
}: ProfileSelectorProps) {
  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
        Failed to load available formats: {error.message}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Available profiles</p>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
        No profiles available for this URL
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700">
        Select download quality:
      </p>
      <div className="space-y-2">
        {profiles.map((profile) => (
          <label
            key={profile.id}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 transition-colors hover:bg-blue-50"
          >
            <input
              type="radio"
              name="profile"
              value={profile.id}
              checked={selectedProfileId === profile.id}
              onChange={() => onSelectProfile(profile.id)}
              className="mt-1"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {profile.label}
              </p>
              {profile.estimatedSize && (
                <p className="text-sm text-gray-500">
                  ~{formatBytes(profile.estimatedSize)}
                </p>
              )}
            </div>
          </label>
        ))}
      </div>
      {selectedProfileId && (
        <p className="text-xs text-gray-500">
          Profile selected. Click the submit button to process download.
        </p>
      )}
    </div>
  );
}
