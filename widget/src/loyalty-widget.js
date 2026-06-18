/**
 * House of Shake - Loyalty Widget
 * Inyectado vía Shopify ScriptTag
 * Vanilla JS + Web Components — sin dependencias externas
 */
(function () {
  'use strict';

  const API_BASE = 'https://clc-house-of-shake.com/api';
  const STORE_URL = 'house-of-shake.myshopify.com';

  // ─── Utilidades ────────────────────────────────────────────────────────────

  function getShopifyCustomerEmail() {
    if (window.ShopifyAnalytics?.meta?.page?.customerId) {
      return window.__st?.cid ? `${window.__st.cid}@shopify.internal` : null;
    }
    // Shopify expone datos del cliente en el meta tag o en window.Shopify.customer
    if (window.Shopify?.customer?.email) return window.Shopify.customer.email;
    return null;
  }

  function getShopifyCustomerId() {
    return window.Shopify?.customer?.id || window.__st?.cid || null;
  }

  async function fetchCustomer() {
    const email = getShopifyCustomerEmail();
    const shopifyId = getShopifyCustomerId();
    if (!email && !shopifyId) return null;

    try {
      const url = email
        ? `${API_BASE}/customers/email/${encodeURIComponent(email)}`
        : `${API_BASE}/customers?shopifyCustomerId=${shopifyId}`;
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) return null;
      const data = await res.json();
      return data.customer;
    } catch {
      return null;
    }
  }

  async function fetchTransactions(customerId) {
    try {
      const res = await fetch(`${API_BASE}/customers/${customerId}/transactions?limit=10`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.transactions || [];
    } catch {
      return [];
    }
  }

  async function redeemPoints(customerId, points) {
    const res = await fetch(`${API_BASE}/customers/${customerId}/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al canjear');
    }
    return res.json();
  }

  // ─── Estilos ──────────────────────────────────────────────────────────────

  const STYLES = `
    :host {
      --hos-primary: #c85032;
      --hos-primary-dark: #a03d26;
      --hos-gold: #f5c842;
      --hos-silver: #b0b0b0;
      --hos-bronze: #cd7f32;
      --hos-white: #ffffff;
      --hos-bg: #fff8f6;
      --hos-text: #1a1a1a;
      --hos-radius: 16px;
      --hos-shadow: 0 8px 32px rgba(200,80,50,0.18);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .hos-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: var(--hos-primary);
      color: white;
      border: none;
      cursor: pointer;
      box-shadow: var(--hos-shadow);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      transition: transform 0.2s, background 0.2s;
    }
    .hos-fab:hover { background: var(--hos-primary-dark); transform: scale(1.08); }
    .hos-fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: var(--hos-gold);
      color: #333;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 6px;
      min-width: 20px;
      text-align: center;
    }

    .hos-panel {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 340px;
      max-height: 80vh;
      background: var(--hos-bg);
      border-radius: var(--hos-radius);
      box-shadow: var(--hos-shadow);
      z-index: 9998;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: opacity 0.25s, transform 0.25s;
      transform-origin: bottom right;
    }
    .hos-panel.hidden { opacity: 0; transform: scale(0.85); pointer-events: none; }

    .hos-header {
      background: var(--hos-primary);
      color: white;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .hos-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
    .hos-close { background: none; border: none; color: white; cursor: pointer; font-size: 20px; padding: 0; line-height: 1; }

    .hos-points-card {
      margin: 16px;
      background: linear-gradient(135deg, var(--hos-primary), var(--hos-primary-dark));
      border-radius: 12px;
      padding: 20px;
      color: white;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .hos-points-card::before {
      content: '';
      position: absolute;
      top: -20px; right: -20px;
      width: 100px; height: 100px;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }
    .hos-points-number { font-size: 42px; font-weight: 800; line-height: 1; }
    .hos-points-label { font-size: 12px; opacity: 0.85; margin-top: 4px; letter-spacing: 0.05em; text-transform: uppercase; }
    .hos-level-badge {
      display: inline-block;
      margin-top: 10px;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .hos-level-BRONZE { background: var(--hos-bronze); color: white; }
    .hos-level-SILVER { background: var(--hos-silver); color: #333; }
    .hos-level-GOLD { background: var(--hos-gold); color: #333; }

    .hos-actions {
      display: flex;
      gap: 8px;
      padding: 0 16px;
    }
    .hos-btn {
      flex: 1;
      padding: 10px;
      border-radius: 10px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .hos-btn:hover { opacity: 0.85; }
    .hos-btn-primary { background: var(--hos-primary); color: white; }
    .hos-btn-secondary { background: #f0e8e6; color: var(--hos-primary); }

    .hos-qr-section {
      margin: 12px 16px;
      text-align: center;
    }
    .hos-qr-section canvas { border-radius: 8px; }
    .hos-qr-label { font-size: 11px; color: #888; margin-top: 4px; }

    .hos-section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #888;
      padding: 8px 16px 4px;
    }

    .hos-transactions { overflow-y: auto; max-height: 200px; padding: 0 16px 8px; }
    .hos-tx-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0e8e6;
    }
    .hos-tx-item:last-child { border-bottom: none; }
    .hos-tx-desc { font-size: 12px; color: #444; flex: 1; }
    .hos-tx-date { font-size: 10px; color: #aaa; }
    .hos-tx-pts { font-size: 13px; font-weight: 700; }
    .hos-tx-pts.earn { color: #2a9d5c; }
    .hos-tx-pts.redeem { color: var(--hos-primary); }

    .hos-modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    }
    .hos-modal-overlay.hidden { display: none; }
    .hos-modal {
      background: white;
      border-radius: 16px;
      padding: 24px;
      width: 320px;
      max-width: 90vw;
    }
    .hos-modal h4 { margin: 0 0 16px; font-size: 18px; }
    .hos-modal input {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #e0d0cc;
      border-radius: 10px;
      font-size: 15px;
      box-sizing: border-box;
      margin-bottom: 12px;
      outline: none;
    }
    .hos-modal input:focus { border-color: var(--hos-primary); }
    .hos-modal-info { font-size: 12px; color: #888; margin-bottom: 16px; }
    .hos-modal-actions { display: flex; gap: 10px; }
    .hos-error { color: #e74c3c; font-size: 12px; margin-bottom: 8px; min-height: 16px; }
    .hos-success-msg { color: #2a9d5c; font-size: 13px; font-weight: 600; text-align: center; padding: 10px; }

    .hos-not-logged {
      padding: 24px 16px;
      text-align: center;
      color: #888;
    }
    .hos-not-logged p { font-size: 14px; margin: 0 0 12px; }
    .hos-not-logged a {
      display: inline-block;
      padding: 10px 24px;
      background: var(--hos-primary);
      color: white;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }

    @media (max-width: 480px) {
      .hos-panel { width: calc(100vw - 32px); right: 16px; }
      .hos-fab { bottom: 16px; right: 16px; }
    }
  `;

  // ─── QR Generator (sin dependencias) ──────────────────────────────────────

  function generateQRCanvas(text, size = 120) {
    // QR simple usando el API de Google Charts (fallback para compatibilidad)
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=fff8f6&color=c85032`;
    img.width = size;
    img.height = size;
    img.style.borderRadius = '8px';
    return img;
  }

  // ─── Web Component ────────────────────────────────────────────────────────

  class LoyaltyWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._customer = null;
      this._panelOpen = false;
      this._transactions = [];
    }

    connectedCallback() {
      this._render();
      this._loadCustomer();
    }

    _render() {
      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <button class="hos-fab" id="hosToggle" aria-label="Ver mis puntos">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <span class="hos-fab-badge" id="hosBadge" style="display:none">0</span>
        </button>

        <div class="hos-panel hidden" id="hosPanel">
          <div class="hos-header">
            <h3>🏆 Mis Puntos</h3>
            <button class="hos-close" id="hosClose">✕</button>
          </div>
          <div id="hosPanelContent">
            <div style="padding:24px;text-align:center;color:#888">
              <div style="font-size:32px;margin-bottom:8px">⏳</div>
              <p style="margin:0">Cargando...</p>
            </div>
          </div>
        </div>

        <div class="hos-modal-overlay hidden" id="hosRedeemModal">
          <div class="hos-modal">
            <h4>Canjear Puntos</h4>
            <div class="hos-modal-info" id="hosRedeemInfo">100 puntos = $5 USD de descuento</div>
            <input type="number" id="hosRedeemInput" placeholder="Puntos a canjear (mín. 100)" min="100" step="100" />
            <div class="hos-error" id="hosRedeemError"></div>
            <div class="hos-modal-actions">
              <button class="hos-btn hos-btn-secondary" id="hosRedeemCancel">Cancelar</button>
              <button class="hos-btn hos-btn-primary" id="hosRedeemConfirm">Canjear</button>
            </div>
          </div>
        </div>
      `;

      this._bindEvents();
    }

    _bindEvents() {
      const sr = this.shadowRoot;
      sr.getElementById('hosToggle').addEventListener('click', () => this._togglePanel());
      sr.getElementById('hosClose').addEventListener('click', () => this._closePanel());
      sr.getElementById('hosRedeemCancel').addEventListener('click', () => this._closeRedeemModal());
      sr.getElementById('hosRedeemConfirm').addEventListener('click', () => this._confirmRedeem());
    }

    _togglePanel() {
      this._panelOpen = !this._panelOpen;
      const panel = this.shadowRoot.getElementById('hosPanel');
      if (this._panelOpen) {
        panel.classList.remove('hidden');
        if (this._customer) this._loadTransactions();
      } else {
        panel.classList.add('hidden');
      }
    }

    _closePanel() {
      this._panelOpen = false;
      this.shadowRoot.getElementById('hosPanel').classList.add('hidden');
    }

    async _loadCustomer() {
      this._customer = await fetchCustomer();
      if (this._customer) {
        const badge = this.shadowRoot.getElementById('hosBadge');
        badge.textContent = this._customer.availablePoints > 999
          ? '999+'
          : this._customer.availablePoints;
        badge.style.display = 'block';
        this._renderCustomerContent();
      } else {
        this._renderNotLogged();
      }
    }

    async _loadTransactions() {
      if (!this._customer) return;
      this._transactions = await fetchTransactions(this._customer.id);
      this._renderCustomerContent();
    }

    _renderCustomerContent() {
      const c = this._customer;
      const levelLabel = { BRONZE: 'BRONCE', SILVER: 'PLATA', GOLD: 'ORO' }[c.level] || 'BRONCE';
      const txHtml = this._transactions.length
        ? this._transactions.map(tx => `
            <div class="hos-tx-item">
              <div>
                <div class="hos-tx-desc">${tx.description}</div>
                <div class="hos-tx-date">${new Date(tx.createdAt).toLocaleDateString('es-MX')}</div>
              </div>
              <div class="hos-tx-pts ${tx.points > 0 ? 'earn' : 'redeem'}">
                ${tx.points > 0 ? '+' : ''}${tx.points} pts
              </div>
            </div>
          `).join('')
        : '<div style="font-size:12px;color:#aaa;padding:8px 0">Sin movimientos aún</div>';

      const qrEl = generateQRCanvas(c.id);
      const qrId = 'hosQrContainer';

      this.shadowRoot.getElementById('hosPanelContent').innerHTML = `
        <div class="hos-points-card">
          <div class="hos-points-number">${c.availablePoints.toLocaleString()}</div>
          <div class="hos-points-label">Puntos disponibles</div>
          <div class="hos-level-badge hos-level-${c.level}">${levelLabel}</div>
        </div>

        <div class="hos-actions">
          <button class="hos-btn hos-btn-primary" id="hosWalletBtn">🍎 Apple Wallet</button>
          <button class="hos-btn hos-btn-secondary" id="hosRedeemBtn">🎁 Canjear</button>
        </div>

        <div class="hos-qr-section">
          <div id="${qrId}"></div>
          <div class="hos-qr-label">Muestra este QR en tienda física</div>
        </div>

        <div class="hos-section-title">Últimos movimientos</div>
        <div class="hos-transactions">${txHtml}</div>
      `;

      // Insertar QR
      const qrContainer = this.shadowRoot.getElementById(qrId);
      if (qrContainer) qrContainer.appendChild(qrEl);

      // Re-bind nuevos botones
      this.shadowRoot.getElementById('hosWalletBtn')?.addEventListener('click', () => this._downloadPass());
      this.shadowRoot.getElementById('hosRedeemBtn')?.addEventListener('click', () => this._openRedeemModal());
    }

    _renderNotLogged() {
      this.shadowRoot.getElementById('hosPanelContent').innerHTML = `
        <div class="hos-not-logged">
          <p>Inicia sesión para ver tus puntos y descargar tu tarjeta Apple Wallet</p>
          <a href="/account/login">Iniciar sesión</a>
        </div>
      `;
    }

    async _downloadPass() {
      if (!this._customer) return;
      try {
        const res = await fetch(`${API_BASE}/customers/${this._customer.id}/wallet-pass`);
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Error descargando pase');
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'houseofshake.pkpass';
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        alert('Error descargando el pase. Inténtalo de nuevo.');
      }
    }

    _openRedeemModal() {
      const c = this._customer;
      if (!c) return;
      const info = this.shadowRoot.getElementById('hosRedeemInfo');
      info.textContent = `Tienes ${c.availablePoints} puntos disponibles. 100 pts = $5 USD.`;
      this.shadowRoot.getElementById('hosRedeemModal').classList.remove('hidden');
      this.shadowRoot.getElementById('hosRedeemError').textContent = '';
      this.shadowRoot.getElementById('hosRedeemInput').value = '';
    }

    _closeRedeemModal() {
      this.shadowRoot.getElementById('hosRedeemModal').classList.add('hidden');
    }

    async _confirmRedeem() {
      const input = this.shadowRoot.getElementById('hosRedeemInput');
      const errorEl = this.shadowRoot.getElementById('hosRedeemError');
      const points = parseInt(input.value);

      if (!points || points < 100) {
        errorEl.textContent = 'Mínimo 100 puntos';
        return;
      }
      if (points % 100 !== 0) {
        errorEl.textContent = 'Los puntos deben ser múltiplo de 100';
        return;
      }
      if (points > this._customer.availablePoints) {
        errorEl.textContent = 'No tienes suficientes puntos';
        return;
      }

      const btn = this.shadowRoot.getElementById('hosRedeemConfirm');
      btn.textContent = '...';
      btn.disabled = true;

      try {
        const result = await redeemPoints(this._customer.id, points);
        this._customer.availablePoints = result.newBalance;
        this._closeRedeemModal();

        // Mostrar código de descuento
        alert(`✅ ¡Canje exitoso!\nCódigo de descuento: ${result.discountCode}\nValor: $${result.discountUsd} USD\n\nCopia este código y úsalo en tu próxima compra.`);

        this._renderCustomerContent();
        const badge = this.shadowRoot.getElementById('hosBadge');
        if (badge) badge.textContent = result.newBalance > 999 ? '999+' : result.newBalance;
      } catch (err) {
        errorEl.textContent = err.message;
      } finally {
        btn.textContent = 'Canjear';
        btn.disabled = false;
      }
    }
  }

  // ─── Inicialización ───────────────────────────────────────────────────────

  if (!customElements.get('hos-loyalty-widget')) {
    customElements.define('hos-loyalty-widget', LoyaltyWidget);
  }

  function mount() {
    if (!document.querySelector('hos-loyalty-widget')) {
      const widget = document.createElement('hos-loyalty-widget');
      document.body.appendChild(widget);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }

})();
