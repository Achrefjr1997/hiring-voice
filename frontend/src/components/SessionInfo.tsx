import { Copy, Check, Send, CheckCircle2, FileText } from "lucide-react";
import { useState } from "react";
import type { CandidateStatus } from "../types";

const STATUS_LABELS: Record<CandidateStatus, { text: string; color: string }> = {
  waiting: { text: "Waiting for candidate…", color: "bg-amber-50 text-amber-700 border-amber-200" },
  connected: { text: "Live", color: "bg-green-50 text-green-700 border-green-200" },
  finished: { text: "Completed — awaiting committee verdict…", color: "bg-blue-50 text-blue-700 border-blue-200" },
  disconnected: { text: "Disconnected — interview paused", color: "bg-red-50 text-red-700 border-red-200" },
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
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-700 flex-1">Session</h2>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}>
          {status.text}
        </span>
      </div>

      <div className="px-4 py-2 flex flex-col gap-2">
        {candidateName && (
          <div className="text-sm">
            <span className="text-gray-400 text-xs">Candidate: </span>
            <span className="font-medium text-gray-800">{candidateName}</span>
          </div>
        )}

        {sessionLink && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 truncate flex-1">{sessionLink}</span>
            <button
              onClick={copyLink}
              disabled={!isSessionReady}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
                isSessionReady
                  ? "border-gray-200 text-gray-600 hover:bg-gray-50"
                  : "border-gray-100 text-gray-300 cursor-not-allowed"
              }`}
            >
              {isSessionReady ? (copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />) : null}
              {isSessionReady ? (copied ? "Copied" : "Copy") : "Initializing AI Agents..."}
            </button>
          </div>
        )}

        {candidateEmail && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 flex-1">Invite: {candidateEmail}</span>
            <button
              onClick={handleSendInvite}
              disabled={inviteSending || inviteSent}
              className={`shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border ${
                inviteSent
                  ? "border-green-200 text-green-600 bg-green-50"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {inviteSent ? (
                <CheckCircle2 size={12} />
              ) : (
                <Send size={12} />
              )}
              {inviteSending ? "Sending..." : inviteSent ? "Sent" : "Send Invite"}
            </button>
          </div>
        )}

        {sessionId && (
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs text-gray-400 flex-1">Export Report</span>
            <a
              href={`/session/${sessionId}/pdf`}
              target="_blank"
              className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <FileText size={12} />
              Download PDF
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
