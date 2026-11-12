/** API 계약 타입 (autolog-server와 공유하는 형태) */

export type Purpose = "COMMUTE" | "BUSINESS" | "PERSONAL";
export type SuggestedPurpose = Purpose | "UNKNOWN";

export interface Vehicle {
  plate: string;
  company: string;
}

export interface Person {
  id: string;
  name: string;
  dept: string;
}

export interface Trip {
  id: number;
  startedAt: string;
  endedAt: string;
  distanceKm: number;
  from: string | null;
  to: string | null;
  /** 서버는 미분류를 null 로 저장할 수 있다(계약상 "UNKNOWN" 도 허용). */
  suggested: SuggestedPurpose | null;
  userId: string | null;
  memo: string | null;
}

export interface PhoneSession {
  sessionId: string;
  vehicle: Vehicle | null;
  people: Person[];
  trips: Trip[];
  expiresAt: string;
  submittedTripIds: number[];
}

export interface SubmissionItem {
  tripId: number;
  purpose: Purpose;
  userId: string | null;
  memo: string | null;
}

export interface AdminSessionSummary {
  sessionId: string;
  vehicle: Vehicle | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  tripCount: number;
  submissionCount: number;
  pendingCount: number;
}

export interface AdminSubmission {
  seq: number;
  tripId: number;
  purpose: Purpose;
  userId: string | null;
  memo: string | null;
  submittedAt: string;
  acked: boolean;
  ackedAt: string | null;
}

export interface AdminSessionDetail {
  sessionId: string;
  vehicle: Vehicle | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  people: Person[];
  trips: Trip[];
  submissions: AdminSubmission[];
}
