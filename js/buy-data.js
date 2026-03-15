let selectedNetwork = "MTN"
let selectedBulkNetwork = "MTN";
let userPricePerGB = 5; // default fallback
let currentUserRoleForPricing = 'client';

function selectNetwork(el) {
  document.querySelectorAll(".network").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
  selectedNetwork = el.querySelector('p').innerText.trim();
}

function selectBulkNetwork(el) {
  el.closest('#bulkNetworkGrid').querySelectorAll(".network").forEach(n => n.classList.remove("active"));
  el.classList.add("active");
  selectedBulkNetwork = el.querySelector('p').innerText.trim();
  updateBulkCount(); // refresh total preview
}

function toggleBulkPanel() {
  const panel = document.getElementById('bulkPanel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';

  // Sync bundle sizes into the bulk dropdown if not already done
  if (!isOpen) {
    const mainOpts = document.getElementById('bundle').options;
    const bulkSel  = document.getElementById('bulkBundle');
    if (bulkSel.options.length <= 1) {
      for (let i = 1; i < mainOpts.length; i++) {
        const opt = document.createElement('option');
        opt.value = mainOpts[i].value;
        opt.textContent = mainOpts[i].textContent;
        bulkSel.appendChild(opt);
      }
    }

    // Attach live preview  listener on bulk bundle change
    bulkSel.addEventListener('change', updateBulkCount);
  }
}

// ==========================================
// PARSE BULK LINES — format: "phone GB"
// Returns array of valid { phone, gb } objects
// ==========================================
function parseBulkLines() {
  const raw = document.getElementById('bulkPhones')?.value || '';
  const valid   = [];
  const skipped = [];

  raw.split('\n').forEach(line => {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) { if (line.trim()) skipped.push(line.trim()); return; }

    const phone   = parts[0].replace(/\D/g, ''); // digits only
    const gbRaw   = parseFloat(parts[1]);

    // Accept 9 or 10 digit phone numbers
    const phoneOk = /^\d{9,10}$/.test(phone);
    const gbOk    = !isNaN(gbRaw) && gbRaw > 0;

    if (phoneOk && gbOk) {
      valid.push({ phone, gb: gbRaw });
    } else {
      skipped.push(line.trim());
    }
  });

  return { valid, skipped };
}

function updateBulkCount() {
  const { valid, skipped } = parseBulkLines();
  const count = valid.length;

  // Update counter badges
  const lineCount = document.getElementById('bulkLineCount');
  if (lineCount) {
    lineCount.innerText = `${count} order${count !== 1 ? 's' : ''}${skipped.length > 0 ? ` · ${skipped.length} skipped` : ''}`;
    lineCount.style.color = skipped.length > 0 ? '#f59e0b' : '#2a7de1';
    lineCount.style.background = skipped.length > 0 ? 'rgba(245,158,11,0.1)': 'rgba(42,125,225,0.1)';
  }

  const badge = document.getElementById('bulkCountBadge');
  if (badge) {
    badge.style.display = count > 0 ? 'inline' : 'none';
    badge.innerText = `${count} orders`;
  }

  // Cost preview — sum each line's cost
  const preview     = document.getElementById('bulkTotalPreview');
  const previewText = document.getElementById('bulkTotalText');
  if (preview && previewText && count > 0) {
    const grandTotal = valid.reduce((sum, item) => sum + item.gb * userPricePerGB, 0).toFixed(2);
    const totalGB    = valid.reduce((sum, item) => sum + item.gb, 0);
    previewText.innerHTML = `${count} orders &nbsp;·&nbsp; <strong>${totalGB}GB total</strong> &nbsp;·&nbsp; Grand total: <strong>₵${grandTotal}</strong>${skipped.length ? ` &nbsp;·&nbsp; <span style="color:#f59e0b;">${skipped.length} invalid line${skipped.length > 1 ? 's' : ''} skipped</span>` : ''}`;
    preview.style.display = 'block';
  } else if (preview) {
    preview.style.display = 'none';
  }
}

function bulkAddToCart() {
  const { valid, skipped } = parseBulkLines();

  if (valid.length === 0) {
    alert('No valid orders found.\n\nFormat each line as:\n  phone_number GB_size\n\nExample:\n  0559623850 2\n  0241234567 5\n\nPhone numbers must be 9 or 10 digits.');
    return;
  }

  const rcfg = (typeof roleConfig !== 'undefined' ? roleConfig[currentUserRoleForPricing] : null) || { label: 'CLIENT', color: '#64748b' };

  valid.forEach(({ phone, gb }) => {
    const amount = parseFloat((gb * userPricePerGB).toFixed(2));
    cartItems.push({
      id:        Date.now() + Math.random(),
      phone,
      network:   selectedBulkNetwork,
      gb,
      amount,
      role:      currentUserRoleForPricing,
      roleLabel: rcfg.label,
      roleColor: rcfg.color
    });
  });

  renderCart();

  // Reset panel
  document.getElementById('bulkPhones').value = '';
  document.getElementById('bulkTotalPreview').style.display = 'none';
  document.getElementById('bulkLineCount').innerText = '0 orders';
  document.getElementById('bulkCountBadge').style.display = 'none';
  document.getElementById('bulkPanel').style.display = 'none';

  const msg = skipped.length > 0
    ? `✅ ${valid.length} order${valid.length > 1 ? 's' : ''} added to cart!\n⚠️ ${skipped.length} invalid line${skipped.length > 1 ? 's were' : ' was'} skipped (bad phone number or missing GB size).`
    : `✅ ${valid.length} order${valid.length > 1 ? 's' : ''} added to cart! Review below and click Pay Now.`;
  alert(msg);
}


// ==========================================
// MAP NETWORK DISPLAY NAMES TO API VALUES
// ==========================================
function getApiNetworkName(displayName) {
  const map = {
    'MTN': 'MTN',
    'Telecel': 'Telecel',
    'Ishare': 'AirtelTigo',
    'AirtelTigo': 'AirtelTigo',
    'Bigtime': 'AirtelTigo',
  };
  return map[displayName] || displayName;
}


// ==========================================
// LOAD ROLE-BASED PRICING + USER BANNER
// ==========================================
let cartItems = [];
let currentUserData = null;

const roleConfig = {
  'admin':        { label: 'ADMIN',        bg: 'rgba(239,68,68,0.15)',   color: '#ef4444' },
  'super agent':  { label: 'SUPER AGENT',  bg: 'rgba(139,92,246,0.15)',  color: '#8b5cf6' },
  'elite agent':  { label: 'ELITE AGENT',  bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },
  'vip_customer': { label: 'VIP CUSTOMER', bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  'client':       { label: 'CLIENT',       bg: 'rgba(100,116,139,0.15)', color: '#64748b' },
};

async function loadBundlePrices() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }

    // Fetch full user profile
    const { data: userData } = await supabase
      .from('users')
      .select('first_name, last_name, role, wallet_balance, merchant_id')
      .eq('id', user.id)
      .single();

    currentUserData = userData;
    currentUserRoleForPricing = userData?.role || 'client';

    // --- Populate User Info Banner ---
    const banner = document.getElementById('userInfoBanner');
    if (banner) {
      banner.style.display = 'flex';
      const firstName = userData?.first_name || 'User';
      const lastName  = userData?.last_name  || '';
      const fullName  = `${firstName} ${lastName}`.trim();
      const initials  = (firstName[0] + (lastName[0] || '')).toUpperCase();

      const rcfg = roleConfig[currentUserRoleForPricing] || roleConfig['client'];

      document.getElementById('bannerAvatar').innerText = initials;
      document.getElementById('bannerName').innerText   = fullName;
      document.getElementById('bannerEmail').innerText  = user.email;
      const bannerRole = document.getElementById('bannerRole');
      bannerRole.innerText = rcfg.label;
      bannerRole.style.background = rcfg.bg;
      bannerRole.style.color      = rcfg.color;
      document.getElementById('bannerWallet').innerText = `₵${parseFloat(userData?.wallet_balance || 0).toFixed(2)}`;
    }

    // --- Get role-based price per GB ---
    const { data: priceData } = await supabase
      .from('pricing')
      .select('price')
      .eq('role', currentUserRoleForPricing)
      .eq('product', 'data_per_gb')
      .single();

    if (priceData) userPricePerGB = parseFloat(priceData.price);

    // Update banner rate
    const bannerRate = document.getElementById('bannerRate');
    if (bannerRate) bannerRate.innerText = `₵${userPricePerGB}/GB`;

    // --- Build bundle dropdown with prices ---
    const bundleSelect = document.getElementById('bundle');
    if (bundleSelect) {
      const sizes = [1, 2, 5, 10];
      bundleSelect.innerHTML = '<option value="">— Select size —</option>';
      sizes.forEach(size => {
        const total = (size * userPricePerGB).toFixed(2);
        const opt = document.createElement('option');
        opt.value = size;
        opt.textContent = `${size}GB  —  ₵${total}`;
        bundleSelect.appendChild(opt);
      });
    }

    // --- Live price preview on bundle change ---
    bundleSelect.addEventListener('change', () => {
      const val = parseFloat(bundleSelect.value);
      const preview = document.getElementById('pricePreview');
      const previewText = document.getElementById('pricePreviewText');
      if (val && preview && previewText) {
        const total = (val * userPricePerGB).toFixed(2);
        previewText.innerHTML = `${val}GB ${selectedNetwork} data will cost <strong>₵${total}</strong> at your <em>${(roleConfig[currentUserRoleForPricing] || roleConfig['client']).label}</em> rate (₵${userPricePerGB}/GB)`;
        preview.style.display = 'block';
      } else if (preview) {
        preview.style.display = 'none';
      }
    });

  } catch(e) {
    console.error('Failed to load pricing:', e);
  }
}

document.addEventListener('DOMContentLoaded', loadBundlePrices);


// ==========================================
// GHANA NETWORK VALIDATION UTILITIES
// (mirrors bulk-order.js — single orders too)
// ==========================================
const CART_NETWORK_PREFIXES = {
  'MTN':     ['024','054','055','059','025','053'],
  'Telecel': ['020','050'],
  'Ishare':  ['026','027','056','057'],
  'Bigtime': ['026','027','056','057'],
};

const CART_PREFIX_TO_NET = {
  '024':'MTN','054':'MTN','055':'MTN','059':'MTN','025':'MTN','053':'MTN',
  '020':'Telecel','050':'Telecel',
  '026':'Ishare','027':'Ishare','056':'Ishare','057':'Ishare',
};

function getCartPrefix(phone) {
  const s = phone.replace(/\D/g,'');
  if (s.length === 10 && s[0] === '0') return s.substring(0,3);       // e.g. 0241234567 → 024
  if (s.length === 9  && s[0] !== '0') return '0' + s.substring(0,2); // e.g. 241234567  → 024
  return null;
}

function detectCartNetwork(phone) {
  const prefix = getCartPrefix(phone);
  return prefix ? (CART_PREFIX_TO_NET[prefix] || null) : null;
}

function isValidCartPhone(phone) {
  const s = phone.replace(/\D/g,'');
  return /^0\d{9}$/.test(s) || /^[1-9]\d{8}$/.test(s);
}

function showCartToast(msg, type = 'info') {
  const old = document.getElementById('cartToast');
  if (old) old.remove();
  const colors = {
    info:    '#1e40af', success: '#065f46',
    warning: '#92400e', error:   '#7f1d1d'
  };
  const icons  = { info:'ℹ️', success:'✅', warning:'⚠️', error:'❌' };
  const t = document.createElement('div');
  t.id = 'cartToast';
  t.style.cssText = `position:fixed;bottom:24px;right:24px;z-index:9999;background:${colors[type]||colors.info};color:white;padding:14px 18px;border-radius:12px;font-size:13px;font-weight:600;font-family:Inter,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);display:flex;align-items:center;gap:10px;max-width:360px;line-height:1.5;`;
  t.innerHTML = `<span style="font-size:18px;">${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ==========================================
// ADD TO CART  (with network + duplicate check)
// ==========================================
async function addToCart() {
  const rawPhone = document.getElementById('phone').value.trim();
  const phone    = rawPhone.replace(/\D/g,'');
  const bundle   = document.getElementById('bundle').value;

  // --- Phone format validation ---
  if (!isValidCartPhone(phone)) {
    showCartToast(
      phone.startsWith('0') && phone.length === 9
        ? 'A 9-digit number must NOT start with 0 (e.g. 241234567).'
        : 'Please enter a valid 9 or 10-digit phone number.',
      'error'
    );
    return;
  }

  if (!bundle) { showCartToast('Please select a bundle size.', 'error'); return; }

  // --- Network prefix validation ---
  const detectedNet = detectCartNetwork(phone);
  if (detectedNet && detectedNet !== selectedNetwork) {
    showCartToast(
      `⚠️ ${phone} belongs to ${detectedNet}, not ${selectedNetwork}. Please select the correct network or change the number.`,
      'warning'
    );
    return;
  }
  if (!detectedNet) {
    showCartToast(`Unknown prefix for ${phone}. Please check the number.`, 'warning');
    return;
  }

  // --- Duplicate pending order check ---
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: existing } = await supabase
        .from('orders')
        .select('id, plan, network')
        .eq('user_id', user.id)
        .eq('phone', phone)
        .eq('status', 'pending')
        .limit(1);

      if (existing && existing.length > 0) {
        const ex = existing[0];
        showCartToast(
          `📅 ${phone} already has a pending ${ex.plan} ${ex.network} order. This will be added as a Scheduled delivery.`,
          'warning'
        );
        // Add to cart but flag as scheduled
        const gb     = parseFloat(bundle);
        const amount = parseFloat((gb * userPricePerGB).toFixed(2));
        const rcfg   = roleConfig[currentUserRoleForPricing] || roleConfig['client'];
        cartItems.push({
          id: Date.now(), phone, network: selectedNetwork, gb, amount,
          role: currentUserRoleForPricing, roleLabel: rcfg.label,
          roleColor: rcfg.color, isScheduled: true
        });
        renderCart();
        document.getElementById('phone').value  = '';
        document.getElementById('bundle').value = '';
        document.getElementById('pricePreview').style.display = 'none';
        return;
      }
    }
  } catch (e) { console.warn('Duplicate check failed:', e); }

  // --- Normal cart add ---
  const gb     = parseFloat(bundle);
  const amount = parseFloat((gb * userPricePerGB).toFixed(2));
  const rcfg   = roleConfig[currentUserRoleForPricing] || roleConfig['client'];

  cartItems.push({
    id: Date.now(), phone, network: selectedNetwork, gb, amount,
    role: currentUserRoleForPricing, roleLabel: rcfg.label,
    roleColor: rcfg.color, isScheduled: false
  });
  renderCart();

  showCartToast(`✅ ${phone} — ${gb}GB added to cart!`, 'success');

  document.getElementById('phone').value  = '';
  document.getElementById('bundle').value = '';
  document.getElementById('pricePreview').style.display = 'none';
}


// ==========================================
// RENDER CART
// ==========================================
function renderCart() {
  const container  = document.getElementById('cartItems');
  const totalBox   = document.getElementById('cartTotal');
  const countBadge = document.getElementById('cartCount');

  if (!cartItems.length) {
    container.innerHTML = '<p style="color:#94a3b8; font-size:13px; text-align:center; padding:10px 0;">Your cart is empty</p>';
    totalBox.style.display = 'none';
    countBadge.innerText = '0 items';
    return;
  }

  const normalCount    = cartItems.filter(i => !i.isScheduled).length;
  const scheduledCount = cartItems.filter(i =>  i.isScheduled).length;
  countBadge.innerText = scheduledCount > 0
    ? `${normalCount} order${normalCount !== 1 ? 's' : ''} · ${scheduledCount} scheduled`
    : `${cartItems.length} item${cartItems.length > 1 ? 's' : ''}`;

  let html = '';
  let grandTotal = 0;

  cartItems.forEach(item => {
    grandTotal += item.amount;
    const schedBadge = item.isScheduled
      ? `<span style="padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; background:rgba(99,102,241,0.1); color:#6366f1; border:1px solid rgba(99,102,241,0.2);">📅 Scheduled</span>`
      : '';
    html += `
      <div class="cart-item" style="margin-bottom:10px; ${item.isScheduled ? 'border:1px solid rgba(99,102,241,0.2); border-radius:10px; padding:4px;' : ''}">
        <div style="flex:1;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <strong style="color:#1e293b; font-size:14px;">${item.network} ${item.gb}GB</strong>
            <span style="background:linear-gradient(135deg,rgba(42,125,225,0.15),rgba(109,40,217,0.1)); color:#2a7de1; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:800;">₵${item.amount.toFixed(2)}</span>
            ${schedBadge}
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span style="font-size:12px; color:#64748b;">📱 ${item.phone}</span>
            <span style="padding:2px 8px; border-radius:20px; font-size:10px; font-weight:700; background:rgba(100,116,139,0.1); color:${item.roleColor};">${item.roleLabel} Rate</span>
          </div>
        </div>
        <button onclick="removeFromCart(${item.id})" style="background:#fef2f2; color:#ef4444; border:1px solid #fecaca; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; flex-shrink:0;">✕ Remove</button>
      </div>
    `;
  });

  container.innerHTML = html;

  totalBox.style.display = 'block';
  let totalHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; padding-top:12px; border-top:1px dashed #e2e8f0; margin-top:4px;">
      <span style="font-size:13px; font-weight:600; color:#64748b;">Grand Total (${cartItems.length} order${cartItems.length > 1 ? 's' : ''})</span>
      <span style="font-size:17px; font-weight:800; color:#0f172a;">₵${grandTotal.toFixed(2)}</span>
    </div>`;
  if (scheduledCount > 0) {
    totalHTML += `<div style="font-size:11px; color:#6366f1; margin-top:6px;">📅 ${scheduledCount} scheduled order${scheduledCount > 1 ? 's' : ''} will be queued — not charged immediately.</div>`;
  }
  totalBox.innerHTML = totalHTML;
}


// ==========================================
// REMOVE FROM CART
// ==========================================
function removeFromCart(id) {
  cartItems = cartItems.filter(i => i.id !== id);
  renderCart();
}


// ==========================================
// MAKE PAYMENT (splits normal vs scheduled)
// ==========================================
async function makePayment() {
  if (!cartItems.length) {
    showCartToast('Your cart is empty. Please add at least one item.', 'error');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { window.location.href = 'login.html'; return; }

  const normalItems    = cartItems.filter(i => !i.isScheduled);
  const scheduledItems = cartItems.filter(i =>  i.isScheduled);

  // Check wallet for ALL items (normal + scheduled)
  const normalTotal    = normalItems.reduce((sum, i) => sum + i.amount, 0);
  const scheduledTotal = scheduledItems.reduce((sum, i) => sum + i.amount, 0);
  const grandTotal     = normalTotal + scheduledTotal;

  const { data: walletData } = await supabase
    .from('users').select('wallet_balance').eq('id', user.id).single();

  if ((walletData?.wallet_balance || 0) < grandTotal) {
    showCartToast(
      `Insufficient wallet balance. Need ₵${grandTotal.toFixed(2)}, have ₵${(walletData?.wallet_balance || 0).toFixed(2)}.`,
      'error'
    );
    return;
  }

  let successCount   = 0;
  let currentBalance = walletData.wallet_balance;

  // --- Process NORMAL orders ---
  for (const item of normalItems) {
    const newBalance = parseFloat((currentBalance - item.amount).toFixed(2));

    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);

    await supabase.from('orders').insert({
      user_id: user.id, network: item.network,
      phone: item.phone, plan: `${item.gb}GB`,
      amount: item.amount, status: 'pending'
    });

    await supabase.from('transactions').insert({
      user_id: user.id, type: 'Data Purchase',
      amount: item.amount, balance_before: currentBalance,
      balance_after: newBalance, status: 'Pending',
    });

    if (window.sendSmsNotification) {
      window.sendSmsNotification(item.phone,
        `Dear Customer, your ${item.gb}GB ${item.network} data order has been received and is being processed. Thank you for using Data4Ghana!`);
    }

    currentBalance = newBalance;
    successCount++;
  }

  // --- Queue SCHEDULED orders (deduct wallet immediately) ---
  let scheduledCount = 0;
  for (const item of scheduledItems) {
    const newBalance = parseFloat((currentBalance - item.amount).toFixed(2));

    await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', user.id);

    await supabase.from('scheduled_orders').insert({
      user_id: user.id, network: item.network,
      phone: item.phone, plan: `${item.gb}GB`,
      amount: item.amount, status: 'scheduled',
      note: 'Multiple order — pending delivery already exists',
      scheduled_at: new Date().toISOString(),
    });

    await supabase.from('transactions').insert({
      user_id: user.id, type: 'Scheduled Data Purchase',
      amount: item.amount, balance_before: currentBalance,
      balance_after: newBalance, status: 'Scheduled',
    });

    currentBalance = newBalance;
    scheduledCount++;
  }

  // Clear cart and update wallet display
  cartItems = [];
  renderCart();
  document.getElementById('bannerWallet').innerText = `₵${currentBalance.toFixed(2)}`;

  const totalDeducted = normalTotal + scheduledTotal;
  let title = `${successCount} Order${successCount > 1 ? 's' : ''} Placed!`;
  let body  = `₵${totalDeducted.toFixed(2)} deducted from your wallet.`;
  if (scheduledCount > 0) {
    title += ` + ${scheduledCount} Scheduled`;
    body  += ` ${scheduledCount} scheduled order${scheduledCount > 1 ? 's are' : ' is'} queued and will be processed from your Schedule page.`;
  }

  if (window.showSuccessPopup) {
    window.showSuccessPopup(title, body, () => {
      if (scheduledCount > 0) window.location.href = 'schedule.html';
      else window.location.reload();
    });
  } else {
    alert(`${successCount} order(s) placed!${scheduledCount > 0 ? ` ${scheduledCount} scheduled.` : ''}`);
    if (scheduledCount > 0) window.location.href = 'schedule.html';
    else window.location.reload();
  }
}



// ==========================================
// BUY DATA - WITH DATA4GHANA API INTEGRATION
// ==========================================
async function buyData(){

let phone = document.getElementById("phone").value
let bundle = document.getElementById("bundle").value

if(phone === "" || bundle === ""){

alert("Fill all fields")
return

}

const { data: { user } } = await supabase.auth.getUser()

if(!user){

window.location.href="login.html"
return

}


let price = parseFloat(bundle) * userPricePerGB   // role-based pricing


let { data } = await supabase
.from("users")
.select("wallet_balance")
.eq("id",user.id)
.single()


if(data.wallet_balance < price){

alert("Insufficient wallet balance")
return

}


let newBalance = data.wallet_balance - price


// Deduct wallet balance first
await supabase
.from("users")
.update({ wallet_balance:newBalance })
.eq("id",user.id)


// ==========================================
// CHECK IF API AUTO-ORDER IS ENABLED
// ==========================================
let apiEnabled = false;
try {
  const { data: settingsData } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "api_auto_order")
    .single();
  apiEnabled = settingsData && settingsData.value === "true";
} catch(e) {
  // If settings table doesn't exist, default to disabled
  apiEnabled = false;
}


let orderStatus = "pending";
let apiReference = null;
let apiResponseData = null;

if (apiEnabled && window.placeDataOrder) {
  // ==========================================
  // AUTOMATIC API ORDER
  // ==========================================
  const apiNetwork = getApiNetworkName(selectedNetwork);
  const dataSize = bundle + "GB";

  const apiResult = await placeDataOrder(apiNetwork, phone, dataSize);

  if (apiResult.success) {
    orderStatus = "completed";
    apiReference = apiResult.data?.reference || apiResult.data?.order_id || null;
    apiResponseData = apiResult.data;
  } else {
    // API FAILED — Refund the wallet
    orderStatus = "failed";
    await supabase
      .from("users")
      .update({ wallet_balance: data.wallet_balance }) // restore original balance
      .eq("id", user.id);

    // Record the failed transaction
    await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "Purchase (Failed)",
        amount: price,
        balance_before: data.wallet_balance,
        balance_after: data.wallet_balance,
        status: "Failed",
        reference: "API_FAIL"
      });

    if (window.showSuccessPopup) {
      window.showSuccessPopup("Order Failed!", `The data order could not be processed. Your ₵${price} has been refunded. Error: ${apiResult.error}`, () => {
        window.location.reload();
      });
    } else {
      alert(`Order failed! Your ₵${price} has been refunded. Error: ${apiResult.error}`);
      window.location.reload();
    }
    return;
  }
}


// Record the transaction (debit)
await supabase
.from("transactions")
.insert({
  user_id: user.id,
  type: "Data Purchase",
  amount: price,
  balance_before: data.wallet_balance,
  balance_after: newBalance,
  status: orderStatus === "completed" ? "Completed" : "Pending",
  reference: apiReference || null
});


// Insert order record
await supabase
.from("orders")
.insert({

user_id:user.id,
network:selectedNetwork,
phone:phone,
bundle:bundle,
price:price,
status: orderStatus,
api_reference: apiReference,
api_response: apiResponseData ? JSON.stringify(apiResponseData) : null

})

// Dispatch SMS Confirmation
if (window.sendSmsNotification) {
  const statusMsg = orderStatus === "completed"
    ? `completed successfully. Ref: ${apiReference || 'N/A'}`
    : `received and is processing`;
  window.sendSmsNotification(phone, `Dear Customer, your order for ${bundle}GB ${selectedNetwork} data has been ${statusMsg}. Thank you for using Data4Ghana!`);
}

// Show Premium Animated Success Modal
if (window.showSuccessPopup) {
  const title = orderStatus === "completed" ? "Order Completed!" : "Order Placed!";
  const msg = orderStatus === "completed"
    ? `Your ${bundle}GB ${selectedNetwork} data has been delivered. Ref: ${apiReference || 'N/A'}`
    : `Your order for ${bundle}GB ${selectedNetwork} data has been placed and is being processed.`;
  window.showSuccessPopup(title, msg, () => {
    window.location.reload();
  });
} else {
  alert(orderStatus === "completed" ? "Order completed successfully!" : "Order placed successfully");
  window.location.reload();
}

}
