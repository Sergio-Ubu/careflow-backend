// server/tools/mockOrderLookup.js
// Tool mock para demo: simula un lookup de estado de pedido.

const MOCK_DB = {
  "45821": { status: "En reparto", carrier: "MRW", eta: "Hoy 18:00–21:00", lastUpdate: "Hace 2h" },
  "12345": { status: "Preparando pedido", carrier: "Correos", eta: "Mañana", lastUpdate: "Hace 6h" },
  "99999": { status: "Incidencia", carrier: "SEUR", eta: "Pendiente", lastUpdate: "Hace 1 día" }
};

export async function mockOrderLookup(orderId) {
  await new Promise(r => setTimeout(r, 150)); // simula latencia
  const row = MOCK_DB[String(orderId || "").trim()];
  return row ? { orderId: String(orderId), ...row } : null;
}