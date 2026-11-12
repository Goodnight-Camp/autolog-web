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

// --- 운행기록부(차량 보고) ---------------------------------------------------------

export type ReportReason = "CLOSED" | "IGNITION_OFF" | "CONFIRMED" | "CORRECTED" | "GAP" | "RESEND";
export type LedgerStatus = "UNCONFIRMED" | "CONFIRMED" | "CORRECTED";
export type StatusFilter = "all" | "unconfirmed" | "confirmed" | "corrected";

export interface LedgerVehicle {
  vehicleId: string;
  plate: string | null;
  company: string | null;
  bizNo: string | null;
  model: string | null;
  fuel: string | null;
  fiscalStart: string | null;
  fiscalEnd: string | null;
  adminEmail: string | null;
  lastReportedAt: string;
  rowCount: number;
}

export interface CorrectionEntry {
  field: "purpose" | "userId" | "memo";
  oldValue: string | null;
  newValue: string | null;
  at: string;
}

/** 운행기록부 한 행 = (차량, 종류, 운행)별 최신 보고 */
export interface LedgerRow {
  vehicleId: string;
  kind: "TRIP" | "GAP";
  tripId: number;
  revision: number;
  company: string | null;
  bizNo: string | null;
  model: string | null;
  plate: string | null;
  fiscalStart: string | null;
  fiscalEnd: string | null;
  usedDate: string;
  weekday: string;
  dept: string | null;
  userName: string | null;
  odoStartKm: number;
  odoEndKm: number;
  distanceKm: number;
  commuteKm: number;
  businessKm: number;
  purpose: Purpose | null;
  remark: string | null;
  status: LedgerStatus;
  statusLabel: string;
  startedAt: string;
  endedAt: string;
  lastReason: ReportReason;
  lastReasonLabel: string;
  lastReportedAt: string;
  reportCount: number;
  demo: boolean;
  gap: boolean;
  flags: string[];
  corrections: CorrectionEntry[];
  missing: string[];
  complete: boolean;
}

export interface LedgerTotals {
  totalKm: number;
  commuteKm: number;
  businessKm: number;
  workKm: number;
  ratio: number;
  rowCount: number;
  incomplete: number;
  unconfirmed: number;
  gaps: number;
}

export interface LedgerResponse {
  vehicles: LedgerVehicle[];
  period: { from: string | null; to: string | null };
  totals: LedgerTotals;
  shown: number;
  rows: LedgerRow[];
}

export interface VehicleReport {
  reportId: string;
  vehicleId: string;
  kind: "TRIP" | "GAP";
  tripId: number;
  revision: number;
  reason: ReportReason;
  trip: {
    startedAt: string;
    endedAt: string;
    odoStartKm: number;
    odoEndKm: number;
    distanceKm: number;
    from: string | null;
    to: string | null;
    purpose: Purpose | null;
    status: "CLOSED_UNCONFIRMED" | "CONFIRMED";
    userName: string | null;
    dept: string | null;
    memo: string | null;
    demo: boolean;
  };
  corrections: CorrectionEntry[];
  occurredAt: string;
  receivedAt: string;
}

export interface LedgerFilters {
  vehicleId: string | null;
  from: string | null;
  to: string | null;
  status: StatusFilter;
  includeIncomplete: boolean;
}
