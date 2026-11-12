import { suggestedPurpose } from "./format.ts";
import type { PhoneSession, Purpose, SubmissionItem, Trip } from "./types.ts";

export const MEMO_MAX = 200;

export interface TripDraft {
  purpose: Purpose | null;
  userId: string | null;
  memo: string;
  /** 이번 제출에 포함할지. 이미 보낸 운행은 기본 제외(다시 보내기로 포함). */
  include: boolean;
}

export type ConfirmFormState = Record<number, TripDraft>;

export type ConfirmFormAction =
  | { type: "purpose"; tripId: number; purpose: Purpose }
  | { type: "user"; tripId: number; userId: string | null }
  | { type: "memo"; tripId: number; memo: string }
  | { type: "include"; tripId: number; include: boolean }
  | { type: "reset"; session: PhoneSession };

function defaultUser(trip: Trip, session: PhoneSession): string | null {
  if (trip.userId && session.people.some((p) => p.id === trip.userId)) {
    return trip.userId;
  }
  return null;
}

export function initForm(session: PhoneSession): ConfirmFormState {
  const submitted = new Set(session.submittedTripIds ?? []);
  const state: ConfirmFormState = {};
  for (const trip of session.trips) {
    state[trip.id] = {
      purpose: suggestedPurpose(trip.suggested),
      userId: defaultUser(trip, session),
      memo: (trip.memo ?? "").slice(0, MEMO_MAX),
      include: !submitted.has(trip.id),
    };
  }
  return state;
}

export function confirmFormReducer(
  state: ConfirmFormState,
  action: ConfirmFormAction,
): ConfirmFormState {
  if (action.type === "reset") return initForm(action.session);
  const cur = state[action.tripId];
  if (!cur) return state;
  let next: TripDraft;
  switch (action.type) {
    case "purpose":
      // 목적을 고르면 이번 제출에 포함한다(이미 보낸 운행의 재제출 포함).
      next = { ...cur, purpose: action.purpose, include: true };
      break;
    case "user":
      next = { ...cur, userId: action.userId };
      break;
    case "memo":
      next = { ...cur, memo: action.memo.slice(0, MEMO_MAX) };
      break;
    case "include":
      next = { ...cur, include: action.include };
      break;
  }
  return { ...state, [action.tripId]: next };
}

/** 제출할(포함 + 목적 선택된) 항목을 trips 순서대로 만든다. */
export function toSubmissionItems(
  state: ConfirmFormState,
  trips: Trip[],
): SubmissionItem[] {
  const items: SubmissionItem[] = [];
  for (const trip of trips) {
    const d = state[trip.id];
    if (!d || !d.include || !d.purpose) continue;
    const memo = d.memo.trim();
    items.push({
      tripId: trip.id,
      purpose: d.purpose,
      userId: d.userId,
      memo: memo ? memo : null,
    });
  }
  return items;
}
