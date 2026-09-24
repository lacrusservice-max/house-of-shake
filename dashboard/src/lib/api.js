/**
 * Peticiones al backend con diagnóstico honesto.
 *
 * Antes cualquier fallo mostraba "Sin conexión. Revisa tu internet", y eso
 * mandaba al cliente a revisar su wifi cuando el problema era el servidor.
 * Pasó de verdad: el backend quedó caído y todo el mundo veía un mensaje que
 * culpaba a su internet.
 *
 * Además `res.json()` revienta cuando el servidor responde algo que no es JSON
 * (una página de error del proveedor, un 502 del balanceador). Ese error subía
 * al catch y terminaba mostrando, otra vez, "revisa tu internet".
 */

export const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error {
  constructor(message, { kind, status } = {}) {
    super(message);
    this.kind = kind;     // 'offline' | 'server' | 'suspended' | 'http'
    this.status = status;
  }
}

const MSG_OFFLINE = 'Sin conexión. Revisa tu internet e intenta de nuevo.';
const MSG_SERVER  = 'No pudimos conectar con el servidor. No es tu internet: es de nuestro lado. Intenta en unos minutos.';
const MSG_SUSPEND = 'Servicio temporalmente suspendido.';

/**
 * @returns {Promise<any>} el JSON de la respuesta
 * @throws  {ApiError} con `kind` para distinguir la causa real
 */
export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}${path}`;

  let res;
  try {
    res = await fetch(url, options);
  } catch {
    // fetch solo lanza por problemas de red. Si el navegador se sabe sin
    // internet es culpa del cliente; si no, el servidor no está respondiendo.
    const sinInternet = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(sinInternet ? MSG_OFFLINE : MSG_SERVER, {
      kind: sinInternet ? 'offline' : 'server',
    });
  }

  if (res.status === 402) throw new ApiError(MSG_SUSPEND, { kind: 'suspended', status: 402 });

  // El cuerpo puede no ser JSON: páginas de error del proveedor, 502, 504…
  let data = null;
  try {
    data = await res.json();
  } catch {
    if (!res.ok) throw new ApiError(MSG_SERVER, { kind: 'server', status: res.status });
    throw new ApiError('Respuesta inesperada del servidor.', { kind: 'server', status: res.status });
  }

  if (!res.ok) {
    // 5xx es siempre del servidor; 4xx trae un mensaje útil para el usuario.
    if (res.status >= 500) throw new ApiError(data?.error || MSG_SERVER, { kind: 'server', status: res.status });
    const err = new ApiError(data?.error || 'No se pudo completar la operación', { kind: 'http', status: res.status });
    err.data = data;
    throw err;
  }

  return data;
}
