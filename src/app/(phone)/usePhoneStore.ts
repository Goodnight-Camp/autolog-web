"use client";

import { useMemo, useSyncExternalStore } from "react";
import {
  HISTORY_KEY,
  PHONE_STORE_EVENT,
  PROFILE_KEY,
  browserStorage,
  loadHistory,
  loadProfile,
  type HistoryEntry,
  type Profile,
} from "@/lib/phoneStore";

function subscribe(cb: () => void) {
  window.addEventListener(PHONE_STORE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PHONE_STORE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function rawOf(key: string): string | null {
  try {
    return browserStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** 저장된 원문 문자열을 스냅샷으로 써서 값이 바뀔 때만 다시 그린다. 서버 렌더링에서는 undefined(아직 모름). */
function useRaw(key: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => rawOf(key),
    () => undefined,
  );
}

/** 이 폰에 저장한 내 이름·부서. undefined = 아직 읽기 전(서버 렌더링), null = 없음 */
export function useProfile(): Profile | null | undefined {
  const raw = useRaw(PROFILE_KEY);
  return useMemo(() => (raw === undefined ? undefined : loadProfile()), [raw]);
}

/** 이 폰에서 보낸 신고 내역(최근순). undefined = 아직 읽기 전 */
export function useHistory(): HistoryEntry[] | undefined {
  const raw = useRaw(HISTORY_KEY);
  return useMemo(() => (raw === undefined ? undefined : loadHistory()), [raw]);
}
