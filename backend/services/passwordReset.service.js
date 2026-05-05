// backend/services/passwordReset.service.js
// Almacén en memoria de tokens de recuperación.
// Se purga automáticamente cuando expira (30 min).
import crypto from 'crypto';

const TTL_MS = 30 * 60 * 1000;
const tokens = new Map();

function ahora() { return Date.now(); }

function purgar() {
    const t = ahora();
    for (const [k, v] of tokens) if (v.expira <= t) tokens.delete(k);
}

export function crearToken(idUsuario) {
    purgar();
    const raw = crypto.randomBytes(32).toString('hex');
    tokens.set(raw, { idUsuario: parseInt(idUsuario), expira: ahora() + TTL_MS });
    return raw;
}

export function consumirToken(raw) {
    purgar();
    const entry = tokens.get(raw);
    if (!entry) return null;
    tokens.delete(raw);
    if (entry.expira <= ahora()) return null;
    return entry.idUsuario;
}

export function verificarToken(raw) {
    purgar();
    const entry = tokens.get(raw);
    if (!entry) return null;
    if (entry.expira <= ahora()) { tokens.delete(raw); return null; }
    return entry.idUsuario;
}
