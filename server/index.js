import express from "express";
import cors from "cors";
import "dotenv/config";

import { route } from "./agents/router.js";
import { solve } from "./agents/solver.js";
import { review } from "./agents/reviewer.js";

import {
  appendMessage,
  getContext,
  getState,
  setState,
  getMeta,
  setMeta,
} from "./memory/sessionStore.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body || {};
    if (!message) return res.status(400).json({ error: "Missing message" });

    const sid = sessionId || "demo";

    // 1) Guardamos el mensaje del usuario
    appendMessage(sid, "user", message);

    // 2) Cargamos contexto y estado
    const context = getContext(sid); // últimos mensajes
    const state = getState(sid);     // estado conversacional
    const meta = getMeta(sid);       // datos extra (email, orderId, etc.)

    // 3) AGENTE 1 — ROUTER (intención + riesgo + acción)
    const routing = route({ message, context, state, meta });

    // 4) AGENTE 2 — SOLVER (resuelve + pide lo que falta + usa herramientas)
    const solved = await solve({
      intent: routing.intent,
      action: routing.action,
      message,
      context,
      state,
      meta,
    });

    // Persistimos estado y meta para multi-turn real
    setState(sid, solved.nextState);
    setMeta(sid, solved.nextMeta);

    // 5) AGENTE 3 — REVIEWER (tono, seguridad, handoff si procede)
    const checked = review({
      draftReply: solved.reply,
      intent: routing.intent,
      risk: routing.risk,
      action: routing.action,
      meta: solved.nextMeta,
    });

    // Guardamos respuesta final
    appendMessage(sid, "assistant", checked.finalReply);

    // Ticket si handoff
    let ticketId = null;
    if (checked.type === "handoff") {
      ticketId = "T-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    }

    return res.json({
      type: checked.type,
      ticketId,
      sessionId: sid,
      intent: routing.intent,
      risk: routing.risk,
      summary: checked.summary,
      reply: checked.finalReply,
      // útil para demo (puedes ocultarlo luego):
      state: solved.nextState,
      meta: solved.nextMeta,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal_error" });
  }
});

app.get("/health", (_, res) => res.send("ok"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("API running on", port));