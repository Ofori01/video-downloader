"use client";

import { useSyncExternalStore } from "react";

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
    const parsed: unknown = JSON.parse(raw);
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

export function useStoredJobFileIds(): string[] {
  return useSyncExternalStore(
    subscribeStoredJobIds,
    readStoredJobIds,
    getStoredJobIdsServerSnapshot,
  );
}

export function rememberJobFileId(fileId: string): string[] {
  const currentFileIds = readStoredJobIds();
  const deduped = currentFileIds.filter((id) => id !== fileId);
  const nextFileIds = [fileId, ...deduped].slice(0, MAX_STORED_JOB_IDS);
  saveStoredJobIds(nextFileIds);
  return nextFileIds;
}
