// Thin REST client for the FastAPI backend. Every interview-flow screen
// goes through here so the transport concern (base URL, JSON headers,
// error shape) lives in one place.

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

class ApiError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : detail?.detail || `Request failed (${status})`);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, isForm = false, timeoutMs } = {}) {
  // No timeout by default — most endpoints should fail exactly when the server
  // responds. Only opted into for calls known to involve a slow LLM round-trip,
  // so a genuinely stuck request surfaces as an error instead of an infinite spinner.
  const controller = timeoutMs ? new AbortController() : undefined;
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: isForm ? undefined : body ? { "Content-Type": "application/json" } : undefined,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ApiError(0, "This is taking longer than expected — the server may still be working on it. Try again in a moment.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail;
    try {
      detail = await res.json();
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }

  // A 204 carries no body, but the server still sends a JSON content-type —
  // parsing it would throw "Unexpected end of JSON input" on an empty string.
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res;
}

export const api = {
  createSession: (payload) => request("/sessions", { method: "POST", body: payload }),
  listSessions: () => request("/sessions"),
  getSession: (sessionId) => request(`/sessions/${sessionId}`),
  // First view of a session's report generates its narrative summary via an LLM
  // call (order of a minute); later views reuse the cached result and return
  // fast. The generous timeout covers a genuinely slow first generation without
  // hanging forever if something is actually stuck.
  getReport: (sessionId) => request(`/sessions/${sessionId}/report`, { timeoutMs: 180_000 }),
  completeSession: (sessionId) => request(`/sessions/${sessionId}/complete`, { method: "POST" }),
  deleteSession: (sessionId) => request(`/sessions/${sessionId}`, { method: "DELETE" }),
  getHint: (sessionQuestionId) => request(`/sessions/questions/${sessionQuestionId}/hint`, { method: "POST" }),

  parseResume: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/resume/parse", { method: "POST", body: form, isForm: true });
  },

  submitAnswer: (sessionQuestionId, audioBlob, filename) => {
    const form = new FormData();
    form.append("file", audioBlob, filename);
    return request(`/questions/${sessionQuestionId}/answer`, { method: "POST", body: form, isForm: true });
  },
  requestFollowUp: (sessionQuestionId) =>
    request(`/questions/${sessionQuestionId}/follow-up`, { method: "POST" }),
  requestNext: (sessionQuestionId) => request(`/questions/${sessionQuestionId}/next`, { method: "POST" }),
  voiceCommand: (sessionQuestionId, command) =>
    request(`/questions/${sessionQuestionId}/voice-command`, { method: "POST", body: { command } }),

  postMonitoringEvent: (payload) =>
    request("/monitoring/events", { method: "POST", body: payload }).catch(() => {
      // Best-effort telemetry — a dropped monitoring beacon shouldn't surface as an app error.
    }),

  recordingUrl: (sessionQuestionId) => `${API_BASE}/questions/${sessionQuestionId}/recording`,

  synthesizeSpeech: async (text) => {
    const res = await request("/voice/tts", { method: "POST", body: { text } });
    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const blob = await res.blob();
    return { blob, contentType };
  },
};

export { ApiError, API_BASE };
