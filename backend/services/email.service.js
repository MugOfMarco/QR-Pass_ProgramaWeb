import nodemailer from 'nodemailer';

let _transporter = null;

// Extrae el email de "Nombre <email@x.com>" o devuelve el string tal cual
function extractEmail(from) {
    const m = from?.match(/<([^>]+)>/);
    return m ? m[1].trim() : (from ?? '').trim();
}

function buildTransporter() {
    const host   = process.env.SMTP_HOST;
    const pass   = process.env.SMTP_PASS;
    const port   = parseInt(process.env.SMTP_PORT  || '587', 10);
    const secure = String(process.env.SMTP_SECURE  || 'false') === 'true';
    // SMTP_USER es opcional: si no está, se extrae el email de SMTP_FROM
    const user   = process.env.SMTP_USER || extractEmail(process.env.SMTP_FROM);

    if (!host || !user || !pass) {
        console.warn(
            `⚠️  SMTP incompleto — ` +
            `SMTP_HOST:${host ? 'OK' : 'FALTA'} ` +
            `SMTP_USER/FROM:${user ? 'OK' : 'FALTA'} ` +
            `SMTP_PASS:${pass ? 'OK' : 'FALTA'}`
        );
        return null;
    }

    console.log(`📧 SMTP configurado — ${host}:${port} user:${user}`);

    return nodemailer.createTransport({
        host, port, secure,
        auth: { user, pass },
        connectionTimeout: 15_000,
        greetingTimeout:   10_000,
        socketTimeout:     15_000,
    });
}

export function smtpConfigurado() {
    const user = process.env.SMTP_USER || extractEmail(process.env.SMTP_FROM);
    return !!(process.env.SMTP_HOST && user && process.env.SMTP_PASS);
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
}

export async function enviarCorreoRecuperacion(destino, nombre, urlReset) {
    if (!destino) throw new Error('Destinatario vacío — el usuario no tiene correo registrado');

    if (!_transporter) _transporter = buildTransporter();

    if (!_transporter) {
        throw new Error(
            'SMTP no configurado: define SMTP_HOST, SMTP_USER (o SMTP_FROM) y SMTP_PASS en las variables de entorno'
        );
    }

    const from = process.env.SMTP_FROM || process.env.SMTP_USER;

    const html = `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #e5dde0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#5c1f33 0%,#3d1422 100%);color:#fff;padding:1.4rem 1.6rem">
                <h1 style="margin:0;font-size:1.3rem">QR Pass — Recuperación de contraseña</h1>
            </div>
            <div style="padding:1.6rem;color:#333;line-height:1.55">
                <p>Hola <strong>${escapeHtml(nombre || 'usuario')}</strong>,</p>
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta. Si fuiste tú, haz clic en el siguiente botón. El enlace caduca en <strong>30 minutos</strong>.</p>
                <p style="text-align:center;margin:1.8rem 0">
                    <a href="${urlReset}" style="display:inline-block;background:#5c1f33;color:#fff;text-decoration:none;padding:.85rem 1.6rem;border-radius:8px;font-weight:700">Restablecer contraseña</a>
                </p>
                <p style="font-size:.85rem;color:#666">Si el botón no funciona, copia este enlace en tu navegador:<br>
                    <span style="word-break:break-all;color:#5c1f33">${urlReset}</span>
                </p>
                <hr style="border:none;border-top:1px solid #eee;margin:1.4rem 0">
                <p style="font-size:.8rem;color:#999">Si tú no solicitaste este cambio, ignora este correo. Tu contraseña actual seguirá funcionando.</p>
            </div>
        </div>
    `;

    const text = `Hola ${escapeHtml(nombre || '')},\n\nPara restablecer tu contraseña visita:\n${urlReset}\n\nEl enlace caduca en 30 minutos.\n\nSi no solicitaste este cambio, ignora este correo.`;

    try {
        const info = await Promise.race([
            _transporter.sendMail({ from, to: destino, subject: 'QR Pass — Recuperación de contraseña', html, text }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP timeout: sin respuesta en 15 s')), 15_000)),
        ]);
        console.log(`✅ Correo enviado a ${destino} — messageId: ${info?.messageId}`);
        return { success: true };
    } catch (err) {
        _transporter = null; // forzar reconexión en el siguiente intento
        console.error(`❌ Error SMTP al enviar a ${destino}:`, err.message);
        throw err;
    }
}
