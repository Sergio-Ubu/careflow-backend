// server/agents/router.js

function norm(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

function detectIntent(text) {
  const t = norm(text);

  // Tracking / pedido
  if (
    t.includes("pedido") ||
    t.includes("seguimiento") ||
    t.includes("tracking") ||
    t.includes("llega") ||
    t.includes("envio") ||
    t.includes("paquete") ||
    t.includes("retras")
  ) {
    return "tracking";
  }

  // Devoluciones
  if (
    t.includes("devol") ||
    t.includes("reembolso") ||
    t.includes("refund") ||
    t.includes("devolver")
  ) {
    return "returns";
  }

  // Garantía / producto roto
  if (
    t.includes("garant") ||
    t.includes("warranty") ||
    t.includes("roto") ||
    t.includes("defect") ||
    t.includes("falla")
  ) {
    return "warranty";
  }

  // Cuenta / acceso
  if (
    t.includes("contraseña") ||
    t.includes("contrasena") ||
    t.includes("password") ||
    t.includes("login") ||
    t.includes("cuenta") ||
    t.includes("bloquead") ||
    t.includes("iniciar sesion") ||
    t.includes("acceso")
  ) {
    return "account";
  }

  return "general";
}

function detectRisk(text) {
  const t = norm(text);
  const angrySignals = [
    "estafa",
    "denuncia",
    "fatal",
    "vergüenza",
    "verguenza",
    "inutil",
    "nadie me responde",
    "enfad",
    "cabre",
    "horrible",
    "pesimo",
  ];

  if (angrySignals.some((w) => t.includes(w))) return "high";
  if (t.length > 220) return "medium";
  return "low";
}

function hasEmail(text) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(text || ""));
}

function hasOrderId(text) {
  // Primero IDs numéricos típicos, luego alfanuméricos tipo Z4P-123
  const s = String(text || "");
  return /\b\d{4,10}\b/.test(s) || /\b[A-Z0-9-]{3,12}\b/i.test(s);
}

function looksLikeReturnsContinuation(text) {
  const t = norm(text);
  return (
    t.includes("recibi") ||
    t.includes("ayer") ||
    t.includes("sin usar") ||
    t.includes("etiquet")
  );
}

function looksLikeAccountContinuation(text) {
  const t = norm(text);
  return (
    t.includes("bloquead") ||
    t.includes("recuper") ||
    t.includes("olvide") ||
    t.includes("olvid") ||
    t.includes("contrasena") ||
    t.includes("contraseña")
  );
}

export function route({ message, context, state, meta }) {
  const detectedIntent = detectIntent(message);
  const risk = detectRisk(message);

  const flow = state?.flow || "idle";
  const activeFlows = new Set(["tracking", "returns", "warranty", "account"]);

  let intent = detectedIntent;

  // 1) Mantener flujo activo si el usuario está contestando dentro del proceso
  if (activeFlows.has(flow)) {
    const t = norm(message);
    const providingTrackingData = hasEmail(message) || hasOrderId(message);
    const detectedIsGeneral = detectedIntent === "general";

    const continuingCurrentFlow =
      (flow === "tracking" && (providingTrackingData || detectedIsGeneral)) ||
      (flow === "returns" && (looksLikeReturnsContinuation(message) || detectedIsGeneral)) ||
      (flow === "account" && (looksLikeAccountContinuation(message) || detectedIsGeneral)) ||
      (flow === "warranty" && detectedIsGeneral);

    if (continuingCurrentFlow) {
      intent = flow;
    }
  }

  // 2) Si manda email/pedido y no detecta nada, asumimos tracking
  if (intent === "general" && (hasOrderId(message) || hasEmail(message))) {
    intent = "tracking";
  }

  // 3) Acción recomendada
  let action = "general_help";

  if (intent === "tracking") {
    const orderKnown = !!meta?.orderId || hasOrderId(message);
    action = orderKnown ? "lookup_tracking" : "ask_tracking_details";
  }

  if (intent === "returns") {
    const t = norm(message);
    const hasReturnInfo =
      t.includes("recibi") || t.includes("ayer") || t.includes("sin usar") || t.includes("etiquet");
    action = hasReturnInfo ? "process_returns" : "ask_returns_details";
  }

  if (intent === "warranty") {
    action = "ask_warranty_details";
  }

  if (intent === "account") {
    const t = norm(message);

    if (t.includes("bloquead")) action = "account_locked_help";
    else if (t.includes("olvide") || t.includes("olvid") || t.includes("contrasena") || t.includes("contraseña"))
      action = "account_password_recovery";
    else action = "ask_account_details";
  }

  return { intent, risk, action };
}