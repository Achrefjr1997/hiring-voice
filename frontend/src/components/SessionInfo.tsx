import { Copy, Check, Send, CheckCircle2, FileText, Download, Link as LinkIcon, Mail, Clock } from "lucide-react";
import { useState } from "react";
import type { CandidateStatus } from "../types";

const STATUS_LABELS: Record<CandidateStatus, { text: string; color: string }> = {
  waiting: { text: "Waiting for candidate…", color: "bg-status-info/20 text-status-info border-status-info/30" },
  connected: { text: "Live", color: "bg-status-live/20 text-status-live border-status-live/30" },
  finished: { text: "Completed — awaiting verdict…", color: "bg-accent-gold/20 text-accent-gold border-accent-gold/30" },
  disconnected: { text: "Disconnected — interview paused", color: "bg-status-alert/20 text-status-alert border-status-alert/30" },
};

export default function SessionInfo({
  sessionLink,
  candidateName,
  candidateStatus,
  isSessionReady,
  candidateEmail,
  onSendInvite,
  sessionId,
}: {
  sessionLink: string | null;
  candidateName: string | null;
  candidateStatus: CandidateStatus;
  isSessionReady: boolean;
  candidateEmail?: string | null;
  onSendInvite?: () => Promise<void>;
  sessionId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const copyLink = () => {
    if (sessionLink) {
      navigator.clipboard.writeText(sessionLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendInvite = async () => {
    if (!onSendInvite) return;
    setInviteSending(true);
    try {
      await onSendInvite();
      setInviteSent(true);
    } finally {
      setInviteSending(false);
    }
  };

  const status = STATUS_LABELS[candidateStatus];
  const isWaiting = candidateStatus === "waiting";

  return (
    <div className="flex flex-col gap-4 p-5">
      {/* Session Status Card */}
      <div className={`rounded-lg border-2 p-4 ${
        isWaiting
          ? "bg-blue-50 border-blue-200"
          : candidateStatus === "connected"
          ? "bg-green-50 border-green-200"
          : candidateStatus === "finished"
          ? "bg-yellow-50 border-yellow-200"
          : "bg-red-50 border-red-200"
      }`}>
        <div className="flex items-center gap-3 mb-2">
          {isWaiting && (
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
          )}
          {candidateStatus === "connected" && (
            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          )}
          <span className={`text-sm font-semibold ${
            isWaiting
              ? "text-blue-700"
              : candidateStatus === "connected"
              ? "text-green-700"
              : candidateStatus === "finished"
              ? "text-yellow-700"
              : "text-red-700"
          }`}>
            {status.text}
          </span>
        </div>
        {candidateName && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">Candidate:</span>
            <span className="font-semibold text-gray-900">{candidateName}</span>
          </div>
        )}
      </div>

      {/* Session Link */}
      {sessionLink && (
        <div className="bg-surface-default border border-border-default rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <LinkIcon size={16} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Interview Link</span>
          </div>
          <div className="flex items-center gap-2 bg-surface-raised border border-border-default rounded-lg p-2.5">
            <span className="text-xs text-text-muted truncate flex-1 font-mono">{sessionLink}</span>
            <button
              onClick={copyLink}
              disabled={!isSessionReady}
              className={`shrink-0 p-2 rounded-lg transition-all ${
                isSessionReady
                  ? copied
                    ? "bg-green-100 text-green-700"
                    : "hover:bg-surface-hover text-gray-600"
                  : "text-text-muted cursor-not-allowed opacity-50"
              }`}
              title={isSessionReady ? (copied ? "Copied!" : "Copy link") : "Initializing..."}
            >
              {isSessionReady ? (copied ? <Check size={16} /> : <Copy size={16} />) : <Clock size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Candidate Email */}
      {candidateEmail && (
        <div className="bg-surface-default border border-border-default rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Mail size={16} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Invitation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-surface-raised border border-border-default rounded-lg px-3 py-2">
              <span className="text-sm text-text-primary">{candidateEmail}</span>
            </div>
            <button
              onClick={handleSendInvite}
              disabled={inviteSending || inviteSent}
              className={`shrink-0 p-2 rounded-lg transition-all ${
                inviteSent
                  ? "bg-green-100 text-green-700"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              } disabled:opacity-50`}
              title={inviteSending ? "Sending..." : inviteSent ? "Sent!" : "Send email invitation"}
            >
              {inviteSent ? <CheckCircle2 size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* Export Report */}
      {sessionId && (
        <a
          href={`/session/${sessionId}/pdf`}
          target="_blank"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-accent-gold text-bg-primary rounded-lg font-semibold text-sm hover:brightness-110 transition-all shadow-sm"
        >
          <Download size={18} />
          Download PDF Report
        </a>
      )}
    </div>
  );
}
