export interface CompetencyCell {
  name: string;
  domain: string;
  classification: "MUST_HAVE" | "NICE_TO_HAVE";
  status: "UNEXPLORED" | "WEAK" | "COVERED";
  confidence: number;
  evidenceCount: number;
  integrityFlagged: boolean;
}

export interface CoverageMapState {
  [competencyId: string]: CompetencyCell;
}

export interface CoverageMapDelta {
  [competencyId: string]: {
    prev_confidence?: number;
    new_confidence: number;
    prev_status?: string;
    new_status?: string;
    evidence_count?: number;
    inferred?: boolean;
    skeptic_adjusted?: boolean;
  };
}

export interface CompetencyNode {
  competency_id: string;
  name: string;
  domain: string;
  classification: "MUST_HAVE" | "NICE_TO_HAVE";
  depth_required: "surface" | "applied" | "expert";
  min_evidence_count: number;
  min_confidence: number;
  weight: number;
}

export interface HiringDecision {
  session_id: string;
  final_recommendation: "STRONG_HIRE" | "HIRE" | "NO_HIRE" | "STRONG_NO_HIRE";
  competency_verdicts: Record<string, {
    competency_id: string;
    verdict: "DEMONSTRATED" | "WEAK" | "NOT_DEMONSTRATED" | "EVIDENCE_INSUFFICIENT";
    key_evidence_ids: string[];
    depth_reached: string;
    integrity_flagged: boolean;
  }>;
  evidence_gaps: string[];
  must_have_total: number;
  must_have_demonstrated: number;
  consensus_reached: boolean;
  deliberation_transcript: { advocate: string; critic: string };
  model_used: string;
}

export type VoiceHireEventType =
  | "COMPETENCY_GRAPH_READY"
  | "COVERAGE_MAP_UPDATE"
  | "PROBE_GENERATED"
  | "CANDIDATE_UTTERANCE"
  | "SPEAK"
  | "INTEGRITY_CHALLENGE"
  | "COMMITTEE_DECISION"
  | "REPORT_READY"
  | "EARLY_COMPLETION"
  | "TIME_LIMIT_REACHED"
  | "INTERVIEW_COMPLETE"
  | "DELIBERATION_FULL"
  | "CANDIDATE_IDENTIFIED"
  | "CANDIDATE_CONNECTED"
  | "CANDIDATE_FINISHED"
  | "CANDIDATE_DISCONNECTED"
  | "INTEGRITY_VIOLATION"
  | "INTEGRITY_PAUSED"
  | "INTEGRITY_RESUMED"
  | "INTEGRITY_TERMINATED";

export interface ParsedVoiceHireEvent {
  bandMessageId: string;
  roomId: string;
  sender: string;
  type: VoiceHireEventType | "OTHER";
  payload: unknown;
  rawContent: string;
  timestamp: string;
}

export interface BandWebSocketEvent {
  type: "message_created" | "participant_joined" | "participant_left";
  room_id: string;
  message?: {
    id: string;
    sender: string;
    content: string;
    created_at: string;
    mentions: string[];
  };
}

export interface BandRooms {
  foundationRoomId: string;
  explorationRoomId: string;
  committeeRoomId: string;
}

export interface CompetencySummaryItem {
  name: string;
  domain: string;
  classification: "MUST_HAVE" | "NICE_TO_HAVE";
  weight: number;
}

export interface CompetencySummary {
  competencies: CompetencySummaryItem[];
  estimated_duration: string;
}

export type CandidateStatus = "waiting" | "connected" | "finished" | "disconnected";

export type EnforcementLevel = "OBSERVATION_ONLY" | "WARNING_MODE" | "AUTO_TERMINATE" | "LOCKDOWN";

export interface IntegrityViolation {
  type: string;
  timestamp: number;
  severity: "warning" | "severe";
  points: number;
}

export interface EnforcementConfig {
  level: EnforcementLevel;
  threshold: number;
  gracePeriod: number;
  demoMode: boolean;
}

export interface BandSessionState {
  sessionId: string | null;
  status: "idle" | "ready" | "active" | "ended";
  events: ParsedVoiceHireEvent[];
  coverageMap: CoverageMapState;
  decision: HiringDecision | null;
  connected: boolean;
  rooms: BandRooms | null;
  candidateName: string | null;
  candidateStatus: CandidateStatus;
  verdictRevealed: boolean;
  deliberationFullText: { advocate: string; critic: string } | null;
  isSessionReady: boolean;
  integrityViolations: IntegrityViolation[];
  enforcementConfig: EnforcementConfig;
  integrityPaused: boolean;
  demoMode: boolean;
}

export function applyCoverageUpdate(
  current: CoverageMapState,
  delta: CoverageMapDelta,
): CoverageMapState {
  const next = { ...current };
  for (const [id, change] of Object.entries(delta)) {
    if (next[id]) {
      next[id] = {
        ...next[id],
        status: (change.new_status as CompetencyCell["status"]) ?? next[id].status,
        confidence: change.new_confidence,
        evidenceCount: change.evidence_count ?? next[id].evidenceCount,
        integrityFlagged: change.skeptic_adjusted ? true : next[id].integrityFlagged,
      };
    }
  }
  return next;
}

export function initCoverageMap(graph: { competencies: CompetencyNode[] }): CoverageMapState {
  const map: CoverageMapState = {};
  for (const c of graph.competencies) {
    map[c.competency_id] = {
      name: c.name,
      domain: c.domain,
      classification: c.classification,
      status: "UNEXPLORED",
      confidence: 0,
      evidenceCount: 0,
      integrityFlagged: false,
    };
  }
  return map;
}
