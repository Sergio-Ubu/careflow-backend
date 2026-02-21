// server/agents/solver.js
import { mockOrderLookup } from "../tools/mockOrderLookup.js";

function norm(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractOrderId(text) {
  const s = String(text || "");
  const num = s.match(/\b\d{4,10}\b/);
  if (num) return num[0];

  const alnum = s.match(/\b[A-Z0-9-]{3,12}\b/i);
  if (!alnum) return null;

  // Evitamos capturar palabras normales como "pedido"
  const candidate = alnum[0];
  const blacklist = ["pedido", "email", "cuenta", "login"];
  if (blacklist.includes(candidate.toLowerCase())) return null;

  return candidate;
}

function extractEmail(text) {
  const m = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : null;
}

export async function solve({ intent, action, message, context, state, meta }) {
  const nextState = { ...(state || {}) };
  const nextMeta = { ...(meta || {}) };
  const t = norm(message);

  // Mantener flow activo
  if (nextState.flow === "idle" || !nextState.flow) nextState.flow = intent;

  // Capturar datos del usuario siempre
  const maybeOrderId = extractOrderId(message);
  const maybeEmail = extractEmail(message);
  if (maybeOrderId) nextMeta.orderId = maybeOrderId;
  if (maybeEmail) nextMeta.email = maybeEmail;

  // =========================
  // TRACKING
  // =========================
  if (action === "ask_tracking_details") {
    return {
      reply:
        "Te ayudo con el seguimiento. Pásame el número de pedido (ej: 45821). " +
        "Si lo tienes, también el email de compra.",
      nextState,
      nextMeta,
    };
  }

  if (action === "lookup_tracking" || nextState.flow === "tracking") {
    if (!nextMeta.orderId) {
      return {
        reply: "Perfecto. Para localizarlo necesito el número de pedido (4–10 dígitos o código de pedido).",
        nextState,
        nextMeta,
      };
    }

    const result = await mockOrderLookup(nextMeta.orderId);

    if (!result) {
      return {
        reply:
          `No encuentro el pedido ${nextMeta.orderId} en el entorno de demo. ` +
          `¿Puedes confirmar el número o pasarme el email de compra para validarlo?`,
        nextState,
        nextMeta,
      };
    }

    // Seguimos en tracking por si el usuario pide cambio de dirección / incidencia
    nextState.flow = "tracking";

    return {
      reply:
        `Listo ✅ Pedido ${nextMeta.orderId}\n` +
        `• Estado: ${result.status}\n` +
        `• Transportista: ${result.carrier}\n` +
        `• ETA: ${result.eta}\n` +
        (result.lastUpdate ? `• Última actualización: ${result.lastUpdate}\n` : "") +
        `\n¿Quieres que te ayude con cambio de dirección, incidencia o devolución?`,
      nextState,
      nextMeta,
    };
  }

  // =========================
  // RETURNS
  // =========================
  if (action === "ask_returns_details") {
    nextState.flow = "returns";
    return {
      reply:
        "Perfecto, gestionamos la devolución. Dime:\n" +
        "1) Cuándo lo recibiste\n" +
        "2) Si está sin usar y con etiquetas\n" +
        "3) Número de pedido (si lo tienes)",
      nextState,
      nextMeta,
    };
  }

  if (action === "process_returns" || nextState.flow === "returns") {
    nextState.flow = "returns";

    const hasConditionInfo =
      t.includes("sin usar") || t.includes("etiquet") || t.includes("ayer") || t.includes("recibi");

    if (!hasConditionInfo) {
      return {
        reply:
          "Para tramitarlo rápido necesito confirmar cuándo lo recibiste y si está sin usar con etiquetas.",
        nextState,
        nextMeta,
      };
    }

    return {
      reply:
        "Perfecto ✅ Parece apto para devolución en el flujo de demo.\n" +
        (nextMeta.orderId ? `Pedido detectado: ${nextMeta.orderId}\n` : "") +
        "Siguiente paso: te envío instrucciones de recogida o punto de entrega.\n" +
        "¿Prefieres recogida a domicilio o entrega en punto de recogida?",
      nextState,
      nextMeta,
    };
  }

  // =========================
  // WARRANTY
  // =========================
  if (action === "ask_warranty_details" || nextState.flow === "warranty") {
    nextState.flow = "warranty";
    return {
      reply:
        "Sobre garantía: dime el producto, la fecha de compra y qué fallo presenta. " +
        "Si tienes número de pedido, mejor.",
      nextState,
      nextMeta,
    };
  }

  // =========================
  // ACCOUNT
  // =========================
  if (action === "ask_account_details") {
    nextState.flow = "account";
    return {
      reply:
        "Entendido. ¿Es recuperar contraseña, cuenta bloqueada o no puedes iniciar sesión? " +
        "Si puedes, dime el email de la cuenta.",
      nextState,
      nextMeta,
    };
  }

  if (action === "account_password_recovery" || (nextState.flow === "account" && t.includes("olvid"))) {
    nextState.flow = "account";
    return {
      reply:
        "Perfecto. Para recuperar la contraseña, te envío el proceso de restablecimiento. " +
        "Si me compartes el email de la cuenta, lo valido primero.",
      nextState,
      nextMeta,
    };
  }

  if (action === "account_locked_help" || (nextState.flow === "account" && t.includes("bloquead"))) {
    nextState.flow = "account";
    return {
      reply:
        "Entendido, cuenta bloqueada. Te ayudo a desbloquearla.\n" +
        "Necesito el email de la cuenta y te indico el siguiente paso (verificación o desbloqueo).",
      nextState,
      nextMeta,
    };
  }

  // =========================
  // GENERAL
  // =========================
  nextState.flow = "general";
  return {
    reply: "Cuéntame el problema con detalle (qué pasó, cuándo y qué esperabas) y te guío paso a paso.",
    nextState,
    nextMeta,
  };
}