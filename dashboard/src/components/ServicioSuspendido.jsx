/**
 * Pantalla que ve cualquier usuario —cliente o staff— cuando la licencia del
 * servicio está vencida.
 *
 * No menciona pagos ni al proveedor por nombre: el cliente final no tiene por
 * qué enterarse de la relación comercial entre el negocio y quien opera el
 * sistema. Y deja claro que los Pinos NO se perdieron, para que nadie crea que
 * su saldo desapareció.
 */
export default function ServicioSuspendido() {
  return (
    <div style={{
      minHeight: '100vh', background: '#FFFFFF', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '24px',
      fontFamily: "'Montserrat', sans-serif",
    }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <img src="/logo-encabezado.png" alt="House of Shake"
             style={{ height: 56, width: 'auto', marginBottom: 28 }} />
        <h1 style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 38, lineHeight: 1.05,
          color: '#0F448B', margin: '0 0 14px', letterSpacing: 1,
        }}>
          Servicio<br />temporalmente<br />suspendido
        </h1>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: 'rgba(15,68,139,.65)', margin: 0 }}>
          El programa de Pinos no está disponible en este momento.
        </p>
        <div style={{
          marginTop: 22, padding: '14px 18px', borderRadius: 12,
          background: 'rgba(15,68,139,.05)', border: '1px solid rgba(15,68,139,.14)',
        }}>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: '#0F448B', margin: 0, fontWeight: 700 }}>
            Tus Pinos están guardados
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'rgba(15,68,139,.6)', margin: '5px 0 0' }}>
            No se perdió nada. Tu saldo y tu historial reaparecerán completos
            cuando el servicio se reactive.
          </p>
        </div>
      </div>
    </div>
  );
}
