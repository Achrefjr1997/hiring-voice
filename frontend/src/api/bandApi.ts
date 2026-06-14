const API_BASE = "http://localhost:8000";

export async function sendAudioChunk(
  sessionId: string,
  audioBlob: Blob,
): Promise<{ filler_url: string | null }> {
  const form = new FormData();
  form.append("audio", audioBlob, "recording.webm");
  const res = await fetch(`${API_BASE}/session/${sessionId}/audio`, {
    method: "POST",
    body: form,
  });
  return res.json();
}
