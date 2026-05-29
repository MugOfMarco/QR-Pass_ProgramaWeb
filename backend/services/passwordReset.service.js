// backend/services/passwordReset.service.js
// Tokens JWT firmados con SESSION_SECRET — no se pierden al reiniciar el servidor.
import jwt from 'jsonwebtoken';

const TTL_S = 30 * 60; // 30 minutos

function secret() {
    return process.env.SESSION_SECRET || 'cecyt9_secret_2025';
}

export function crearToken(idUsuario) {
    return jwt.sign(
        { sub: String(idUsuario), purpose: 'pwd-reset' },
        secret(),
        { expiresIn: TTL_S }
    );
}

export function verificarToken(raw) {
    try {
        const payload = jwt.verify(raw, secret());
        if (payload.purpose !== 'pwd-reset') return null;
        return parseInt(payload.sub, 10);
    } catch {
        return null;
    }
}

// consumirToken = verificarToken (el enlace expira solo a los 30 min)
export function consumirToken(raw) {
    return verificarToken(raw);
}
