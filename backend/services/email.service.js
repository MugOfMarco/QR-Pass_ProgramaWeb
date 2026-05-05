// backend/services/email.service.js
import nodemailer from 'nodemailer';

let transporter = null;
let lastConfigError = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = String(process.env.SMTP_SECURE || 'false') === 'true';

    if (!host || !user || !pass) {
        lastConfigError = 'SMTP no configurado (SMTP_HOST/SMTP_USER/SMTP_PASS)';
        return null;
    }

    transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    return transporter;
}

export async function enviarCorreoRecuperacion(destino, nombre, urlReset) {
    const t = getTransporter();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@qrpass.local';

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

    if (!t) {
        console.warn('⚠️  Email no enviado (' + lastConfigError + ')');
        console.warn('🔗 Enlace de recuperación para ' + destino + ': ' + urlReset);
        return { success: true, devLink: urlReset, warning: lastConfigError };
    }

    await t.sendMail({
        from, to: destino,
        subject: 'QR Pass — Recuperación de contraseña',
        html,
        text: `Hola ${nombre || ''},\n\nPara restablecer tu contraseña visita: ${urlReset}\n\nEl enlace caduca en 30 minutos.\n\nSi no solicitaste este cambio, ignora este correo.`,
    });

    return { success: true };
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;',
    }[c]));
}
