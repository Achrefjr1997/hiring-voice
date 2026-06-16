import { Copy, Check, Send, CheckCircle2, FileText } from "lucide-react";
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

  return (
    <div className="flex flex-col gap-1.5 p-4">
      {/* Status badge + candidate name */}
      <div className="flex items-center gap-3">
        <h2 className="text-caption font-medium text-text-secondary uppercase tracking-wide">Session</h2>
        <span className={`px-2 py-0.5 rounded-radius-card text-caption font-medium border ${status.color}`}>
          {status.text}
        </span>
      </div>

      {candidateName && (
        <div className="text-body">
          <span className="text-caption text-text-muted">Candidate: </span>
          <span className="font-medium text-text-primary">{candidateName}</span>
        </div>
      )}

      {sessionLink && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-text-muted truncate flex-1 font-mono">{sessionLink}</span>
          <button
            onClick={copyLink}
            disabled={!isSessionReady}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 text-caption font-medium rounded-radius-card border transition-colors ${
              isSessionReady
                ? "border-border-default text-text-secondary hover:bg-surface-hover"
                : "border-border-default text-text-muted cursor-not-allowed opacity-50"
            }`}
          >
            {isSessionReady ? (copied ? <Check size={12} className="text-status-live" /> : <Copy size={12} />) : null}
            {isSessionReady ? (copied ? "Copied" : "Copy") : "Initializing..."}
          </button>
        </div>
      )}

      {candidateEmail && (
        <div className="flex items-center gap-2">
          <span className="text-caption text-text-muted flex-1">Invite: {candidateEmail}</span>
          <button
            onClick={handleSendInvite}
            disabled={inviteSending || inviteSent}
            className={`shrink-0 flex items-center gap-1 px-2 py-1 text-caption font-medium rounded-radius-card border transition-colors ${
              inviteSent
                ? "border-status-live/30 text-status-live bg-status-live/10"
                : "border-border-default text-text-secondary hover:bg-surface-hover"
            }`}
          >
            {inviteSent ? <CheckCircle2 size={12} /> : <Send size={12} />}
            {inviteSending ? "Sending..." : inviteSent ? "Sent" : "Send Invite"}
          </button>
        </div>
      )}

      {sessionId && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-border-default">
          <span className="text-caption text-text-muted flex-1">Export Report</span>
          <a
            href={`/session/${sessionId}/pdf`}
            target="_blank"
            className="shrink-0 flex items-center gap-1 px-2 py-1 text-caption font-medium rounded-radius-card border border-border-default text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <FileText size={12} />
            Download PDF
          </a>
        </div>
      )}
    </div>
  );
}
