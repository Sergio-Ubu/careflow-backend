import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Agente 1: Orchestrator (intención + riesgo)
function detectIntent(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("pedido") || t.includes("seguimiento") || t.includes("tracking") || t.includes("llega"))
    return "tracking";
  if (t.includes("devol") || t.includes("reembolso") || t.includes("refund"))
    return "returns";
  if (t.includes("garant") || t.includes("warranty"))
    return "warranty";
  if (t.includes("contraseña") || t.includes("password") || t.includes("login"))
    return "account";
  return "general";
}

function detectRisk(text) {
  const t = (text || "").toLowerCase();
  const angrySignals = [
    "estafa", "denuncia", "fatal", "vergüenza", "inútil", "nadie me responde", "enfad", "cabre"
  ];
  if (angrySignals.some(w => t.includes(w))) return "high";
  if (t.length > 220) return "medium";
  return "low";
}

// Agente 2: Resolver (MVP)
function resolverReply(intent) {
  const replies = {
    tracking: "Te ayudo con el seguimiento. Pásame número de pedido y email de compra y lo reviso.",
    returns: "Perfecto, gestionamos la devolución. ¿Cuándo lo recibiste y el producto está sin usar?",
    warranty: "Sobre garantía: dime el producto y la fecha de compra y te indico el proceso.",
    account: "Entendido. ¿Quieres recuperar contraseña o tienes la cuenta bloqueada?",
    general: "Cuéntame el problema con detalle y te guío paso a paso."
  };
  return replies[intent] || replies.general;
}

// Agente 3: Escalation / Handoff
function makeTicket() {
  return "T-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

app.post("/api/chat", (req, res) => {
  const { message, sessionId } = req.body || {};
  if (!message) return res.status(400).json({ error: "Missing message" });

  const intent = detectIntent(message);
  const risk = detectRisk(message);

  // Regla MVP: si riesgo alto -> handoff
  if (risk === "high") {
    const ticketId = makeTicket();
    return res.json({
      type: "handoff",
      ticketId,
      sessionId: sessionId || "demo",
      intent,
      risk,
      summary: "Cliente con señales de frustración. Requiere intervención humana.",
      suggestedReply: "Siento la experiencia. Voy a revisar tu caso ahora mismo y darte una solución clara.",
      reply: `Entiendo tu frustración. Para resolverlo bien, te paso con un agente humano. Ticket: ${ticketId}.`
    });
  }

  return res.json({
    type: "answer",
    intent,
    risk,
    reply: resolverReply(intent)
  });
});

app.get("/health", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API running on", port));