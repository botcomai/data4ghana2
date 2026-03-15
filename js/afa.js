// ============================================
// AFA PORTAL — afa.js
// Handles role-based pricing, wallet checks,
// and Supabase submissions for AFA registrations.
// ============================================

let afaPremiumPrice = 30;  // default fallback
let afaNormalPrice  = 25;  // default fallback
let afaCurrentUser  = null;

// ============================================
// INIT: Load user, pricing, and display info
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    afaCurrentUser = user;

    await loadAfaPricing(user.id);
  } catch (e) {
    console.error('AFA init error:', e);
  }
});

// ============================================
// LOAD ROLE-BASED PRICING
// ============================================
async function loadAfaPricing(userId) {
  try {
    // Get user role
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    const userRole = userData?.role || 'client';

    // Fetch AFA prices for this role
    const { data: prices } = await supabase
      .from('pricing')
      .select('product, price')
      .eq('role', userRole)
      .in('product', ['afa_premium', 'afa_normal']);

    if (prices) {
      prices.forEach(p => {
        if (p.product === 'afa_premium') afaPremiumPrice = parseFloat(p.price);
        if (p.product === 'afa_normal')  afaNormalPrice  = parseFloat(p.price);
      });
    }

    // Update button labels with actual prices
    const premiumBtn = document.querySelector('.premium');
    const normalBtn  = document.querySelector('.normal');
    if (premiumBtn) premiumBtn.textContent = `Premium (₵${afaPremiumPrice.toFixed(2)})`;
    if (normalBtn)  normalBtn.textContent  = `Normal (₵${afaNormalPrice.toFixed(2)})`;

    // Show role badge in subtitle
    const roleLabels = {
      admin: 'Admin', super_agent: 'Super Agent',
      elite_agent: 'Elite Agent', vip_customer: 'VIP Customer', client: 'Client'
    };
    const subtitleElem = document.querySelector('.subtitle');
    if (subtitleElem) {
      subtitleElem.innerHTML = `Manage your AFA services <span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; background:rgba(16,185,129,0.1); color:#10b981; margin-left:6px;">${roleLabels[userRole] || 'Client'} Rate</span>`;
    }
  } catch (e) {
    console.error('Failed to load AFA pricing:', e);
  }
}

// ============================================
// MODAL HELPERS
// ============================================
function openPremium()  { document.getElementById('premiumModal').style.display = 'flex'; }
function closePremium() { document.getElementById('premiumModal').style.display = 'none'; }
function openNormal()   { document.getElementById('normalModal').style.display = 'flex'; }
function closeNormal()  { document.getElementById('normalModal').style.display = 'none'; }

// ============================================
// GET WALLET BALANCE
// ============================================
async function getWallet() {
  const { data } = await supabase
    .from('users')
    .select('wallet_balance')
    .eq('id', afaCurrentUser.id)
    .single();
  return parseFloat(data?.wallet_balance || 0);
}

// ============================================
// PREMIUM AFA FORM SUBMISSION
// ============================================
document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('afaForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = 'Processing...';

    try {
      const walletBalance = await getWallet();
      const price = afaPremiumPrice;

      if (walletBalance < price) {
        alert(`Insufficient wallet balance. You need ₵${price.toFixed(2)} but have ₵${walletBalance.toFixed(2)}.`);
        btn.disabled = false;
        btn.innerText = 'Pay & Register';
        return;
      }

      const { error: insertErr } = await supabase
        .from('afa_registrations')
        .insert({
          user_id:   afaCurrentUser.id,
          full_name: document.getElementById('pName').value,
          phone:     document.getElementById('pPhone').value,
          id_type:   document.getElementById('pIdType').value,
          id_number: document.getElementById('pIdNumber').value,
          tier:      'premium',
          status:    'pending'
        });

      if (insertErr) throw insertErr;

      // Deduct wallet
      const newBalance = parseFloat((walletBalance - price).toFixed(2));
      await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', afaCurrentUser.id);

      // Log transaction
      await supabase.from('transactions').insert({
        user_id:        afaCurrentUser.id,
        type:           'AFA Premium Registration',
        amount:         price,
        balance_before: walletBalance,
        balance_after:  newBalance,
        status:         'Completed'
      });

      closePremium();

      // SMS notification
      const phoneNum = document.getElementById('pPhone').value;
      if (window.sendSmsNotification) {
        window.sendSmsNotification(phoneNum, 'Welcome to Data4Ghana! Your Premium AFA Registration has been successfully completed.');
      }

      if (window.showSuccessPopup) {
        window.showSuccessPopup('AFA Registered!', `Your Premium AFA account has been configured. Wallet charged ₵${price.toFixed(2)}.`, () => {
          window.location.reload();
        });
      } else {
        alert('Premium AFA Registered!');
        window.location.reload();
      }

    } catch (err) {
      console.error('Premium AFA error:', err);
      alert('Registration failed: ' + err.message);
      btn.disabled = false;
      btn.innerText = 'Pay & Register';
    }
  });

  // ============================================
  // NORMAL AFA FORM SUBMISSION
  // ============================================
  document.getElementById('normalForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const idFront = document.getElementById('nIdFront').files[0];
    const idBack  = document.getElementById('nIdBack').files[0];

    if (!idFront || !idBack) {
      alert('Please upload both the front and back of your ID card.');
      return;
    }

    const btn = this.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerText = 'Uploading Documents...';

    try {
      const walletBalance = await getWallet();
      const price = afaNormalPrice;

      if (walletBalance < price) {
        alert(`Insufficient wallet balance. You need ₵${price.toFixed(2)} but have ₵${walletBalance.toFixed(2)}.`);
        btn.disabled = false;
        btn.innerText = 'Pay & Register';
        return;
      }

      // Upload ID front
      const frontPath = `afa/${afaCurrentUser.id}/id_front_${Date.now()}.${idFront.name.split('.').pop()}`;
      const { error: frontErr } = await supabase.storage.from('tickets').upload(frontPath, idFront);
      if (frontErr) throw new Error('ID front upload failed: ' + frontErr.message);

      // Upload ID back
      const backPath = `afa/${afaCurrentUser.id}/id_back_${Date.now()}.${idBack.name.split('.').pop()}`;
      const { error: backErr } = await supabase.storage.from('tickets').upload(backPath, idBack);
      if (backErr) throw new Error('ID back upload failed: ' + backErr.message);

      btn.innerText = 'Saving Registration...';

      const { error: insertErr } = await supabase
        .from('afa_registrations')
        .insert({
          user_id:   afaCurrentUser.id,
          full_name: document.getElementById('nName').value,
          phone:     document.getElementById('nPhone').value,
          id_type:   document.getElementById('nIdType').value,
          id_number: document.getElementById('nIdNumber').value,
          tier:      'normal',
          status:    'pending_verification'
        });

      if (insertErr) throw insertErr;

      // Deduct wallet
      const newBalance = parseFloat((walletBalance - price).toFixed(2));
      await supabase.from('users').update({ wallet_balance: newBalance }).eq('id', afaCurrentUser.id);

      // Log transaction
      await supabase.from('transactions').insert({
        user_id:        afaCurrentUser.id,
        type:           'AFA Normal Registration',
        amount:         price,
        balance_before: walletBalance,
        balance_after:  newBalance,
        status:         'Completed'
      });

      closeNormal();

      // SMS notification
      const phoneNum = document.getElementById('nPhone').value;
      if (window.sendSmsNotification) {
        window.sendSmsNotification(phoneNum, 'Data4Ghana: Your Normal AFA Registration has been submitted and is currently pending verification.');
      }

      if (window.showSuccessPopup) {
        window.showSuccessPopup('Request Submitted!', `Your Normal AFA registration is pending verification. Wallet charged ₵${price.toFixed(2)}.`, () => {
          window.location.reload();
        });
      } else {
        alert('Normal AFA Registered!');
        window.location.reload();
      }

    } catch (err) {
      console.error('Normal AFA error:', err);
      alert('Registration failed: ' + err.message);
      btn.disabled = false;
      btn.innerText = 'Pay & Register';
    }
  });

});