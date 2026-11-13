"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createQrDecoder } from "@/lib/qrDecoder";
import { cameraSupport, classifyCameraError, resolveScannedValue, type CameraProblem } from "@/lib/scan";

type CamState =
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "found" }
  | { kind: "problem"; problem: CameraProblem };

const PROBLEM_TEXT: Record<CameraProblem, { title: string; body: string; retry: boolean }> = {
  insecure: {
    title: "이 주소에서는 웹 카메라를 열 수 없어요",
    body: "브라우저는 보안 연결(https)에서만 웹 페이지에 카메라를 열어 줘요.",
    retry: false,
  },
  unsupported: {
    title: "이 브라우저는 웹 카메라를 지원하지 않아요",
    body: "다른 브라우저(Chrome, Safari)로 열거나 아래 방법을 써 주세요.",
    retry: false,
  },
  denied: {
    title: "카메라 권한이 꺼져 있어요",
    body: "주소창의 사이트 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.",
    retry: true,
  },
  nocamera: {
    title: "카메라를 찾지 못했어요",
    body: "이 기기에서 쓸 수 있는 카메라가 없어요.",
    retry: true,
  },
  busy: {
    title: "다른 앱이 카메라를 쓰고 있어요",
    body: "카메라를 쓰는 다른 앱을 닫고 다시 시도해 주세요.",
    retry: true,
  },
  error: {
    title: "카메라를 열지 못했어요",
    body: "잠시 후 다시 시도해 주세요.",
    retry: true,
  },
};

const SCAN_INTERVAL_MS = 200;
const INVALID_NOTICE_MS = 3500;

/** QR 스캔(폰 셸 기본 탭): 후면 카메라로 차 화면의 QR을 읽어 그 운행 신고 화면으로 이동한다. */
export default function ScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cam, setCam] = useState<CamState>({ kind: "starting" });
  const [invalid, setInvalid] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const invalidTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showInvalid = useCallback(() => {
    setInvalid(true);
    clearTimeout(invalidTimer.current);
    invalidTimer.current = setTimeout(() => setInvalid(false), INVALID_NOTICE_MS);
  }, []);

  useEffect(() => () => clearTimeout(invalidTimer.current), []);

  useEffect(() => {
    const problem = cameraSupport({
      isSecureContext: window.isSecureContext,
      hasGetUserMedia: typeof navigator.mediaDevices?.getUserMedia === "function",
    });
    if (problem) {
      setCam({ kind: "problem", problem });
      return;
    }

    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastInvalid = "";
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };

    setCam({ kind: "starting" });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        const video = videoRef.current;
        if (stopped || !video) {
          stop();
          return;
        }
        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        setCam({ kind: "live" });

        const decoder = await createQrDecoder();
        const tick = async () => {
          if (stopped) return;
          let text: string | null = null;
          if (video.readyState >= 2) {
            try {
              text = await decoder.decode(video);
            } catch {
              text = null;
            }
          }
          if (stopped) return;
          if (text) {
            const r = resolveScannedValue(text);
            if (r.ok) {
              stop();
              setCam({ kind: "found" });
              window.location.assign(r.path);
              return;
            }
            // 같은 QR을 계속 비추는 동안 안내를 반복해 깜빡이지 않게 한다.
            if (text !== lastInvalid) {
              lastInvalid = text;
              showInvalid();
            }
          }
          timer = setTimeout(tick, SCAN_INTERVAL_MS);
        };
        tick();
      } catch (e) {
        if (!stopped) setCam({ kind: "problem", problem: classifyCameraError(e) });
        stop();
      }
    })();

    return stop;
  }, [attempt, showInvalid]);

  const live = cam.kind === "live" || cam.kind === "found";
  const problem = cam.kind === "problem" ? PROBLEM_TEXT[cam.problem] : null;

  return (
    <div className="scan">
      <h1 className="phone-title">차 화면의 QR을 비춰 주세요</h1>
      <p className="phone-sub">시동을 켜면 차 화면에 이번 운행용 QR이 나타나요</p>

      <div className={`viewfinder${live ? " is-live" : ""}${problem ? " is-problem" : ""}`}>
        <video ref={videoRef} className="vf-video" muted playsInline aria-hidden="true" />
        {!live && (
          <div className="vf-state" role="status">
            <CameraIcon off={!!problem} />
            <span>{problem ? "카메라를 쓸 수 없어요" : "카메라를 켜는 중…"}</span>
          </div>
        )}
        {cam.kind === "found" && (
          <div className="vf-state vf-found" role="status">
            <span>확인했어요 · 여는 중…</span>
          </div>
        )}
        <span className="vf-corner tl" aria-hidden="true" />
        <span className="vf-corner tr" aria-hidden="true" />
        <span className="vf-corner bl" aria-hidden="true" />
        <span className="vf-corner br" aria-hidden="true" />
        {live && cam.kind !== "found" && <span className="vf-line" aria-hidden="true" />}
      </div>

      {invalid && (
        <div className="alert alert-error scan-notice" role="alert">
          오토로그 차량 QR이 아니에요. 차 화면에 나온 QR을 비춰 주세요.
        </div>
      )}

      {problem && (
        <section className="scan-problem" role="alert" aria-live="polite">
          <strong>{problem.title}</strong>
          <p>{problem.body}</p>
          <ul>
            <li>
              <b>휴대폰 기본 카메라로 찍어도 돼요.</b> 카메라 앱으로 차 화면의 QR을 비추면 바로 열려요.
            </li>
            <li>
              카메라가 안 되면 <b>코드 직접 입력</b>으로 차 화면 QR 아래 8자리 코드를 넣어 주세요.
            </li>
          </ul>
          {problem.retry && (
            <button type="button" className="btn btn-small" onClick={() => setAttempt((n) => n + 1)}>
              카메라 다시 시도
            </button>
          )}
        </section>
      )}

      <p className="scan-hint">
        <ClockIcon />
        <span>QR은 시동마다 바뀌어요 · 지난 QR은 쓸 수 없어요</span>
      </p>

      <Link href="/c" className={`btn btn-block ${problem ? "btn-primary" : ""}`}>
        코드 직접 입력
      </Link>
    </div>
  );
}

function CameraIcon({ off }: { off: boolean }) {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
