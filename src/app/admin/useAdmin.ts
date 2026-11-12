"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

const KEY = "autolog.adminKey";
export const REFRESH_MS = 5000;

function readKey(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeKey(v: string | null): void {
  try {
    if (v) window.sessionStorage.setItem(KEY, v);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    // 저장소를 쓸 수 없으면(사생활 보호 모드 등) 메모리에만 둔다.
  }
}

/** 관리자 키: sessionStorage 에 보관. 로드 전에는 undefined. */
export function useAdminKey() {
  const [key, setKeyState] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    setKeyState(readKey());
  }, []);
  const setKey = useCallback((v: string | null) => {
    writeKey(v);
    setKeyState(v);
  }, []);
  return [key, setKey] as const;
}

/**
 * 관리자 API 를 주기적으로 호출한다.
 * 401 이면 onUnauthorized 를 부르고 멈춘다.
 */
export function usePolling<T>(
  key: string | null | undefined,
  fetcher: (key: string, signal: AbortSignal) => Promise<T>,
  onUnauthorized: () => void,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => {
    fetcherRef.current = fetcher;
    unauthorizedRef.current = onUnauthorized;
  });

  useEffect(() => {
    if (!key) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ac = new AbortController();

    const tick = async () => {
      try {
        const d = await fetcherRef.current(key, ac.signal);
        if (stopped) return;
        setData(d);
        setError(null);
        setUpdatedAt(new Date());
      } catch (e) {
        if (stopped) return;
        if (e instanceof ApiError && e.status === 401) {
          unauthorizedRef.current();
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      }
      if (!stopped) timer = setTimeout(tick, REFRESH_MS);
    };
    tick();
    return () => {
      stopped = true;
      ac.abort();
      if (timer) clearTimeout(timer);
    };
  }, [key]);

  return { data, error, updatedAt };
}
