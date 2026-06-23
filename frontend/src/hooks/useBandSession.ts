import { useState, useEffect, useRef, useCallback } from "react";
import { sendAudioChunk } from "../api/bandApi";
import type {
  BandSessionState,
  ParsedVoiceHireEvent,
  VoiceHireEventType,
  CoverageMapDelta,
  HiringDecision,
  CompetencyNode,
} from "../types";
import { initCoverageMap, applyCoverageUpdate } from "../types";

const RECONNECT_DELAY = 2000;

function createInitialState(sessionId: string): BandSessionState {
  return {
    sessionId,
    status: "ready",
    events: [],
    coverageMap: {},
    decision: null,
    connected: false,
    rooms: null,
    candidateName: null,
    candidateStatus: "waiting",
    verdictRevealed: false,
    deliberationFullText: null,
    isSessionReady: false,
    integrityViolations: [],
    enforcementConfig: { level: "OBSERVATION_ONLY", threshold: 3, gracePeriod: 1, demoMode: true },
    integrityPaused: false,
    demoMode: true,
  };
}

export function useBandSession() {
  const [sessions, setSessions] = useState<Record<string, BandSessionState>>({});
  const wsRefs = useRef<Record<string, WebSocket>>({});
  const reconnectTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const connect = useCallback((sessionId: string) => {
    if (wsRefs.current[sessionId]) {
      wsRefs.current[sessionId].close();
    }
    clearTimeout(reconnectTimers.current[sessionId]);

    setSessions((prev) => ({
      ...prev,
      [sessionId]: prev[sessionId] ?? createInitialState(sessionId),
    }));

    const url = `/ws/${sessionId}`;
    const ws = new WebSocket(url);
    wsRefs.current[sessionId] = ws;

    ws.onopen = () => {
      setSessions((prev) => {
        const s = prev[sessionId];
        return s ? { ...prev, [sessionId]: { ...s, connected: true } } : prev;
      });
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const eventType = data.event;
      const topic = data.topic || "";
      const payload = { ...data };
      delete payload.event;
      delete payload.topic;

      if (!eventType || !topic) return;

      if ((eventType === "message_created" || eventType === "event_created") && payload) {
        const parsed = parseBandMessage(topic, payload);
        setSessions((prev) => {
          const s = prev[sessionId];
          if (!s) return prev;
          return { ...prev, [sessionId]: reduceEvent(s, parsed) };
        });
      }
    };

    ws.onclose = () => {
      setSessions((prev) => {
        const s = prev[sessionId];
        return s ? { ...prev, [sessionId]: { ...s, connected: false } } : prev;
      });
      reconnectTimers.current[sessionId] = setTimeout(() => {
        if (wsRefs.current[sessionId]) {
          connect(sessionId);
        }
      }, RECONNECT_DELAY);
    };
  }, []);

  const disconnect = useCallback((sessionId: string) => {
    wsRefs.current[sessionId]?.close();
    delete wsRefs.current[sessionId];
    clearTimeout(reconnectTimers.current[sessionId]);
    delete reconnectTimers.current[sessionId];
    setSessions((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const sendAudio = useCallback(async (sessionId: string, audioBlob: Blob): Promise<string | null> => {
    const { filler_url } = await sendAudioChunk(sessionId, audioBlob);
    return filler_url;
  }, []);

  useEffect(
    () => () => {
      for (const sid of Object.keys(wsRefs.current)) {
        wsRefs.current[sid]?.close();
      }
      for (const sid of Object.keys(reconnectTimers.current)) {
        clearTimeout(reconnectTimers.current[sid]);
      }
    },
    [],
  );

  return { sessions, connect, disconnect, sendAudio };
}

let _msgSeq = 0;

function parseBandMessage(topic: string, payload: any): ParsedVoiceHireEvent {
  const content = payload.content || "";
  const rawSender = payload.sender_name || payload.sender || payload.handle;
  const sender = typeof rawSender === "string" ? rawSender : rawSender?.name || "system";
  const msgId = payload.id || payload.message?.id || `evt-${++_msgSeq}`;

  const roomId = topic.replace("chat_room:", "");

  const prefixes: [VoiceHireEventType, string][] = [
    ["COMPETENCY_GRAPH_READY", "COMPETENCY_GRAPH_READY:"],
    ["COVERAGE_MAP_UPDATE", "COVERAGE_MAP_UPDATE:"],
    ["PROBE_GENERATED", "PROBE_GENERATED:"],
    ["CANDIDATE_UTTERANCE", "CANDIDATE_UTTERANCE:"],
    ["SPEAK", "SPEAK:"],
    ["INTEGRITY_CHALLENGE", "INTEGRITY CHALLENGE:"],
    ["COMMITTEE_DECISION", "COMMITTEE_DECISION:"],
    ["REPORT_READY", "REPORT_READY"],
    ["EARLY_COMPLETION", "EARLY_COMPLETION:"],
    ["CANDIDATE_IDENTIFIED", "CANDIDATE_IDENTIFIED:"],
    ["DELIBERATION_FULL", "DELIBERATION_FULL:"],
    ["CANDIDATE_CONNECTED", "CANDIDATE_CONNECTED:"],
    ["CANDIDATE_FINISHED", "CANDIDATE_FINISHED"],
    ["CANDIDATE_DISCONNECTED", "CANDIDATE_DISCONNECTED"],
    ["SESSION_END", "SESSION_END:"],
    ["INTEGRITY_VIOLATION", "INTEGRITY_VIOLATION:"],
    ["INTEGRITY_PAUSED", "INTEGRITY_PAUSED:"],
    ["INTEGRITY_RESUMED", "INTEGRITY_RESUMED:"],
    ["INTEGRITY_TERMINATED", "INTEGRITY_TERMINATED:"],
  ];

  for (const [type, prefix] of prefixes) {
    if (content.includes(prefix)) {
      const raw = content.split(prefix, 2)[1]?.trim() ?? "";
      let parsedPayload: unknown = raw;
      try { parsedPayload = JSON.parse(raw); } catch { /* keep raw */ }
      return {
        bandMessageId: msgId,
        roomId,
        sender,
        type,
        payload: parsedPayload,
        rawContent: content,
        timestamp: payload.inserted_at || payload.created_at || payload.timestamp,
      };
    }
  }

  return {
    bandMessageId: msgId,
    roomId,
    sender,
    type: "OTHER",
    payload: content,
    rawContent: content,
    timestamp: payload.inserted_at || payload.created_at || payload.timestamp,
  };
}

function reduceEvent(
  s: BandSessionState,
  event: ParsedVoiceHireEvent,
): BandSessionState {
  const next = { ...s, events: [event, ...s.events].slice(0, 200) };

  switch (event.type) {
    case "COMPETENCY_GRAPH_READY": {
      const graph = event.payload as { competencies: CompetencyNode[] };
      return { ...next, coverageMap: initCoverageMap(graph), status: "active" as const, isSessionReady: true };
    }
    case "COVERAGE_MAP_UPDATE":
      return { ...next, coverageMap: applyCoverageUpdate(s.coverageMap, event.payload as CoverageMapDelta) };
    case "CANDIDATE_IDENTIFIED": {
      const name = event.payload as { first_name: string; last_name: string };
      return { ...next, candidateName: `${name.first_name} ${name.last_name}`, candidateStatus: "connected" as const };
    }
    case "CANDIDATE_CONNECTED":
      return { ...next, status: "active" as const, candidateStatus: "connected" as const };
    case "CANDIDATE_FINISHED":
      return { ...next, candidateStatus: "finished" as const };
    case "CANDIDATE_DISCONNECTED":
      return { ...next, candidateStatus: "disconnected" as const };
    case "COMMITTEE_DECISION":
      return { ...next, decision: event.payload as HiringDecision, status: "ended" as const };
    case "DELIBERATION_FULL":
      return { ...next, deliberationFullText: event.payload as { advocate: string; critic: string } };
    case "REPORT_READY":
      return { ...next, verdictRevealed: true };
    case "INTEGRITY_VIOLATION":
      return { ...next, integrityViolations: [...s.integrityViolations, event.payload as any] };
    case "INTEGRITY_PAUSED":
      return { ...next, integrityPaused: true };
    case "INTEGRITY_RESUMED":
      return { ...next, integrityPaused: false };
    case "INTEGRITY_TERMINATED":
      return { ...next, integrityPaused: false, status: "ended" as const };
    case "SESSION_END":
      return { ...next, status: "ended" as const };
    default:
      return next;
  }
}
