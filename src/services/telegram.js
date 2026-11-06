const { config } = require("../config");
const Order = require("../models/Order");

const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const som = (n) => `${new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 0 }).format(n).replace(/\u00a0/g, " ")} so'm`;

function isConfigured() {
  return Boolean(config.telegram.token && config.telegram.chatId);
}

function formatOrderTime(date) {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleString("uz-UZ", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function sendRaw(method, payload) {
  if (!isConfigured()) return { ok: false, error: "Telegram bot token yoki chat ID kiritilmagan" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegram.token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: config.telegram.chatId, ...payload }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      const msg = data.description || `HTTP ${res.status}`;
      console.error(`Telegram [${method}] xatosi:`, msg);
      return { ok: false, error: msg };
    }
    return { ok: true, data };
  } catch (err) {
    console.error(`Telegram [${method}] so'rovida xato:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function send(text) {
  const res = await sendRaw("sendMessage", { text, parse_mode: "HTML", disable_web_page_preview: false });
  return res.ok;
}

function buildOrderMessage(order) {
  const lines = (order.items || []).map((i, idx) => {
    const cat = i.category ? ` [${esc(i.category)}]` : "";
    return `${idx + 1}. <b>${esc(i.name)}</b>${cat}\n   └ ${i.quantity} dona × ${som(i.unitPrice)} = <b>${som(i.unitPrice * i.quantity)}</b>`;
  });

  const addressParts = [
    order.address ? `📍 <b>Manzil:</b> ${esc(order.address)}` : "",
    order.house ? `🏢 <b>Uy/bino:</b> ${esc(order.house)}` : "",
    order.floor ? `🪜 <b>Qavat:</b> ${esc(order.floor)}` : "",
    order.apartment ? `🚪 <b>Kvartira:</b> ${esc(order.apartment)}` : "",
    order.landmark ? `🚩 <b>Mo‘ljal:</b> ${esc(order.landmark)}` : "",
    order.note ? `📝 <b>Mijoz izohi:</b> ${esc(order.note)}` : "",
  ].filter(Boolean).join("\n");

  const lat = order.location?.latitude;
  const lng = order.location?.longitude;
  const mapLink = lat && lng ? `\n🗺 <b>Google Maps:</b> <a href="https://www.google.com/maps?q=${lat},${lng}">Xaritada ochish (${lat.toFixed(5)}, ${lng.toFixed(5)})</a>` : "";

  return [
    `🛒 <b>YANGI BUYURTMA #${esc(order.orderNumber)}</b>`,
    `⏰ <b>Vaqt:</b> ${formatOrderTime(order.createdAt)}`,
    `👤 <b>Mijoz:</b> ${esc(order.customerName)}`,
    `📞 <b>Telefon:</b> <code>${esc(order.phone)}</code>`,
    "",
    `📦 <b>Mahsulotlar:</b>`,
    ...lines,
    "",
    `💰 <b>Umumiy summa:</b> <b>${som(order.total)}</b>`,
    "",
    addressParts,
    mapLink,
  ].filter(Boolean).join("\n");
}

/**
 * Buyurtmani Telegram botga yuboradi.
 * Agar birinchi mahsulot rasmi mavjud bo'lsa, uni rasm bilan birga yuboradi.
 * Agar lokatsiya koordinatalari bo'lsa, Telegram sendLocation orqali haqiqiy location xabari yuboradi.
 * Natijani bazada order.telegramSent va order.telegramError ga saqlaydi.
 */
async function notifyNewOrder(order) {
  if (!order || !order._id) return { ok: false, error: "Buyurtma topilmadi" };

  if (!isConfigured()) {
    await Order.updateOne({ _id: order._id }, { $set: { telegramSent: false, telegramError: "Telegram bot sozlanmagan" } });
    return { ok: false, error: "Telegram bot sozlanmagan" };
  }

  const text = buildOrderMessage(order);
  const firstItem = order.items && order.items[0];
  let photoUrl = firstItem?.image || "";
  if (photoUrl && photoUrl.startsWith("/")) {
    photoUrl = `${config.publicUrl}${photoUrl}`;
  }

  let sent = false;
  let lastError = "";

  // 1. Agar rasm bo'lsa va http bo'lsa, sendPhoto bilan urinib ko'ramiz
  if (photoUrl && /^https?:\/\//i.test(photoUrl) && text.length <= 1024) {
    const photoRes = await sendRaw("sendPhoto", {
      photo: photoUrl,
      caption: text,
      parse_mode: "HTML",
    });
    if (photoRes.ok) {
      sent = true;
    } else {
      console.log("Rasm bilan yuborishda xatolik, oddiy matn bilan yuborilmoqda...");
      lastError = photoRes.error;
    }
  }

  // 2. Agar rasm bilan yuborilmagan bo'lsa, sendMessage bilan yuboramiz
  if (!sent) {
    const msgRes = await sendRaw("sendMessage", {
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    });
    if (msgRes.ok) {
      sent = true;
      lastError = "";
    } else {
      lastError = msgRes.error || "Telegramga yuborib bo'lmadi";
    }
  }

  // 3. Agar xaritadagi lokatsiya mavjud bo'lsa, Telegram sendLocation yuboramiz
  const lat = order.location?.latitude;
  const lng = order.location?.longitude;
  if (sent && typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    try {
      await sendRaw("sendLocation", {
        latitude: lat,
        longitude: lng,
      });
    } catch (locErr) {
      console.error("Lokatsiya xabari yuborilmadi:", locErr.message);
    }
  }

  // 4. Bazada holatni yangilaymiz
  await Order.updateOne(
    { _id: order._id },
    {
      $set: {
        telegramSent: sent,
        telegramError: sent ? "" : String(lastError || "Xatolik"),
      },
    }
  );

  return { ok: sent, error: lastError };
}

module.exports = { notifyNewOrder, send, sendRaw, isConfigured, buildOrderMessage };
