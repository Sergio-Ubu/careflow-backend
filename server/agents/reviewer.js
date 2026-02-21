function softenTone(text) {
  return String(text || "").replace(/\bNO\b/g, "no");
}

export function review({ draftReply, intent, risk, action, meta }) {
  if (risk === "high") {
    return {
      type: "handoff",
      summary: "Cliente con señales de frustración o escalada. Requiere intervención humana.",
      finalReply:
        "Entiendo tu frustración. Para resolverlo bien, te paso con un agente humano ahora mismo. " +
        "Te dejo el ticket en pantalla para seguimiento.",
    };
  }

  const finalReply = softenTone(draftReply);

  return {
    type: "answer",
    summary: `Respuesta generada por flujo ${intent}${meta?.orderId ? " con orderId" : ""}.`,
    finalReply,
  };
}