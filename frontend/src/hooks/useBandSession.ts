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

export function useBandSession() {
  const [state, setState] = useState<BandSessionState>({
    sessionId: null,
    status: "idle",
    events: [],
    coverageMap: {},
    decision: null,
    connected: false,
    rooms: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const connect = useCallback((sessionId: string) => {
    sessionIdRef.current = sessionId;
    setState((s) => ({ ...s, sessionId, status: "ready" as const }));

    const url = `/ws/${sessionId}`;
    const ws = new WebSocket(url);

    ws.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      const eventType = data.event;
      const topic = data.topic || "";
      const payload = { ...data };
      delete payload.event;
      delete payload.topic;

      if (!eventType || !topic) return;

      if (eventType === "message_created" && payload) {
        const parsed = parseBandMessage(topic, payload);
        handleParsedEvent(parsed, setState);
        return;
      }

      if (eventType === "event_created" && payload) {
        const parsed = parseBandMessage(topic, payload);
        handleParsedEvent(parsed, setState);
        return;
      }
    };

    ws.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
      reconnectTimer.current = setTimeout(
        () => { if (sessionIdRef.current) connect(sessionIdRef.current); },
        RECONNECT_DELAY,
      );
    };

    wsRef.current = ws;
  }, []);

  const sendAudio = useCallback(async (audioBlob: Blob): Promise<string | null> => {
    if (!state.sessionId) return null;
    const { filler_url } = await sendAudioChunk(state.sessionId, audioBlob);
    return filler_url;
  }, [state.sessionId]);

  useEffect(
    () => () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimer.current ?? undefined);
    },
    [],
  );

  return { state, connect, sendAudio };
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

function handleParsedEvent(
  event: ParsedVoiceHireEvent,
  setState: React.Dispatch<React.SetStateAction<BandSessionState>>,
) {
  setState((s) => {
    const next = { ...s, events: [event, ...s.events].slice(0, 200) };

    switch (event.type) {
      case "COMPETENCY_GRAPH_READY": {
        const graph = event.payload as { competencies: CompetencyNode[] };
        return { ...next, coverageMap: initCoverageMap(graph), status: "active" as const };
      }
      case "COVERAGE_MAP_UPDATE":
        return { ...next, coverageMap: applyCoverageUpdate(s.coverageMap, event.payload as CoverageMapDelta) };
      case "COMMITTEE_DECISION":
        return { ...next, decision: event.payload as HiringDecision, status: "ended" as const };
      default:
        return next;
    }
  });
}
