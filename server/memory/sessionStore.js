// Memoria en RAM por sessionId (suficiente para hackathon demo)
const sessions = new Map();

function ensureSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      messages: [],
      state: {
        flow: "idle", // idle | tracking | returns | warranty | account | general
      },
      meta: {
        orderId: null,
        email: null,
      },
    });
  }
  return sessions.get(sessionId);
}

export function appendMessage(sessionId, role, content) {
  const s = ensureSession(sessionId);
  s.messages.push({
    role,
    content,
    ts: Date.now(),
  });
  // Recorta para no crecer infinito
  if (s.messages.length > 30) s.messages = s.messages.slice(-30);
}

export function getContext(sessionId) {
  const s = ensureSession(sessionId);
  return s.messages.slice(-10);
}

export function getState(sessionId) {
  const s = ensureSession(sessionId);
  return s.state;
}

export function setState(sessionId, nextState) {
  const s = ensureSession(sessionId);
  s.state = nextState;
}

export function getMeta(sessionId) {
  const s = ensureSession(sessionId);
  return s.meta;
}

export function setMeta(sessionId, nextMeta) {
  const s = ensureSession(sessionId);
  s.meta = nextMeta;
}