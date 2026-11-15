const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Dipakai dengan router.param('id', validateIdParam) */
export function validateIdParam(_req, _res, next, value) {
  if (!isUuid(value)) return next(new HttpError(400, 'ID tidak valid'));
  next();
}

/** Lempar error Supabase apa adanya supaya ditangkap error handler. */
export function check({ data, error }) {
  if (error) throw error;
  return data;
}

export function cleanString(value, { field, max = 200, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new HttpError(400, `${field} wajib diisi`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} harus berupa teks`);
  const v = value.trim();
  if (required && !v) throw new HttpError(400, `${field} wajib diisi`);
  if (v.length > max) throw new HttpError(400, `${field} maksimal ${max} karakter`);
  return v || null;
}

export function cleanHttpUrl(value, field = 'URL') {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return u.toString();
  } catch {
    throw new HttpError(400, `${field} harus berupa tautan http(s) yang valid`);
  }
}
