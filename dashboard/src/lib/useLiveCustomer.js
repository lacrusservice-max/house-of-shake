import { useState, useEffect, useCallback, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Cada cuánto se revisa el saldo mientras la pantalla está a la vista.
const POLL_MS = 20000;

/**
 * Mantiene los datos del cliente SIEMPRE al día.
 *
 * Antes cada pantalla hacía `useEffect(..., [])`: pedía el saldo una sola vez
 * al montar y nunca más. En el celular la app queda viva en segundo plano, así
 * que el cliente pagaba, el barista le sumaba Pinos, volvía a la app… y seguía
 * viendo el saldo viejo. Los Pinos estaban en la base; la pantalla no los
 * volvía a pedir nunca.
 *
 * Ahora se recarga cuando:
 *   · se monta la pantalla
 *   · el cliente vuelve a la app o a la pestaña (visibilitychange / focus)
 *   · pasan POLL_MS con la pantalla a la vista
 *   · se llama a refresh() a mano
 *
 * @param {object}   opts
 * @param {Function} opts.onUnauthorized  se llama si el token ya no sirve
 */
export function useLiveCustomer({ onUnauthorized } = {}) {
  const token = localStorage.getItem('hos_customer_token');

  const [customer, setCustomer] = useState(
    () => JSON.parse(localStorage.getItem('hos_customer') || 'null')
  );
  const [loading, setLoading]     = useState(!customer);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [offline, setOffline]     = useState(false);
  // El backend responde 402 cuando la licencia del servicio está vencida.
  const [suspended, setSuspended] = useState(false);

  // Evita que dos recargas simultáneas se pisen (volver a la app dispara
  // visibilitychange y focus casi a la vez).
  const enVuelo = useRef(false);
  const onUnauthRef = useRef(onUnauthorized);
  onUnauthRef.current = onUnauthorized;

  const refresh = useCallback(async ({ silent = true } = {}) => {
    if (!token || enVuelo.current) return null;
    enVuelo.current = true;
    if (!silent) setRefreshing(true);

    try {
      const res = await fetch(`${API}/me`, {
        headers: { Authorization: `Bearer ${token}` },
        // Sin esto, el navegador puede devolver la respuesta guardada y el
        // saldo se vería viejo aunque la petición sí salga.
        cache: 'no-store',
      });

      if (res.status === 401) {
        onUnauthRef.current?.();
        return null;
      }
      if (res.status === 402) { setSuspended(true); return null; }
      setSuspended(false);
      if (!res.ok) { setOffline(true); return null; }

      const data = await res.json();
      if (data?.customer) {
        setCustomer(data.customer);
        localStorage.setItem('hos_customer', JSON.stringify(data.customer));
        setUpdatedAt(new Date());
        setOffline(false);
        return data.customer;
      }
      return null;
    } catch {
      setOffline(true);
      return null;
    } finally {
      enVuelo.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refresh({ silent: false });

    const alVolver = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);
    // pageshow cubre el "back-forward cache" de Safari en iOS, donde la página
    // se restaura tal cual estaba y ni visibilitychange ni focus se disparan.
    window.addEventListener('pageshow', alVolver);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
      window.removeEventListener('pageshow', alVolver);
      clearInterval(timer);
    };
  }, [refresh]);

  return { customer, setCustomer, loading, refreshing, updatedAt, offline, suspended, refresh };
}

/** "hace un momento" · "hace 3 min" — para que se vea que el dato está fresco. */
export function haceCuanto(fecha) {
  if (!fecha) return '';
  const seg = Math.floor((Date.now() - fecha.getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}
