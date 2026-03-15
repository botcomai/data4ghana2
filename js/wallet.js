// ==========================================
// PAYMENT GATEWAY SETTINGS (loaded from DB)
// ==========================================
let paystackPublicKey = '';
let paystackEnabled = true;
let manualEnabled = true;

async function loadPaymentSettings() {
  try {
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['paystack_public_key', 'paystack_enabled', 'manual_transfer_enabled']);

    if (settings) {
      settings.forEach(s => {
        if (s.key === 'paystack_public_key') paystackPublicKey = s.value;
        if (s.key === 'paystack_enabled') paystackEnabled = s.value === 'true';
        if (s.key === 'manual_transfer_enabled') manualEnabled = s.value === 'true';
      });
    }

    // Hide/disable payment methods based on settings
    const paystackOpt = document.getElementById('optPaystack');
    const manualOpt = document.getElementById('optManual');

    if (!paystackEnabled && paystackOpt) {
      paystackOpt.style.opacity = '0.4';
      paystackOpt.style.pointerEvents = 'none';
      paystackOpt.innerHTML = '<h4>Paystack</h4><p style="color:#ef4444; font-weight:600;">Currently unavailable</p>';
      // If paystack is default but disabled, switch to manual
      if (manualEnabled) {
        selectMethod('manual');
      }
    }

    if (!manualEnabled && manualOpt) {
      manualOpt.style.opacity = '0.4';
      manualOpt.style.pointerEvents = 'none';
      manualOpt.innerHTML = '<h4>Manual Transfer (Agent)</h4><p style="color:#ef4444; font-weight:600;">Currently unavailable</p>';
    }

    if (!paystackEnabled && !manualEnabled) {
      const fundBtn = document.getElementById('fundBtn');
      if (fundBtn) {
        fundBtn.disabled = true;
        fundBtn.innerText = 'All payment methods are currently disabled';
        fundBtn.style.background = '#94a3b8';
      }
    }

  } catch(e) {
    console.error('Failed to load payment settings:', e);
  }
}

document.addEventListener('DOMContentLoaded', loadPaymentSettings);


function payWithPaystack(){
  if (!paystackEnabled) {
    alert('Paystack payments are currently disabled. Please use another payment method.');
    return;
  }
  if (!paystackPublicKey) {
    alert('Payment gateway is not configured. Please contact support.');
    return;
  }

  let amountInput = document.getElementById("amount").value;
  let amount = parseFloat(amountInput);

  if(isNaN(amount) || amount <= 0){
    alert("Enter valid amount");
    return;
  }

  // Multiply by 1.02 to apply the 2% charge, then by 100 for PESEWAS
  let totalWithFee = amount * 1.02;
  let paystackAmount = Math.round(totalWithFee * 100); 

  let handler = PaystackPop.setup({
    key: paystackPublicKey,
    email: "customer@email.com", // In a real app, fetch the active user email
    amount: paystackAmount,
    currency: "GHS",
    callback: async function(response){
      // 1. Get current logged in user
      const { data: { user } } = await supabase.auth.getUser();
      if(!user) return;

      // 2. Fetch current wallet balance
      let { data: userData } = await supabase
        .from("users")
        .select("wallet_balance, phone")
        .eq("id", user.id)
        .single();
        
      let oldBalance = userData.wallet_balance || 0;
      let newBalance = oldBalance + amount; // Only credit the requested base amount

      // 3. Update the wallet balance
      await supabase
        .from("users")
        .update({ wallet_balance: newBalance })
        .eq("id", user.id);

      // 4. Record the specific transaction (Deposit)
      await supabase
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "Deposit",
          amount: amount,
          balance_before: oldBalance,
          balance_after: newBalance,
          status: "Completed",
          reference: response.reference
        });

      if(window.sendSmsNotification && userData.phone) {
        window.sendSmsNotification(userData.phone, `Wallet Funded: ₵${amount} has been successfully credited to your Data4Ghana account.`);
      }

      if(window.showSuccessPopup) {
        window.showSuccessPopup("Wallet Funded!", "Your wallet has been successfully credited with ₵" + amount + ".", () => {
          window.location.reload();
        });
      } else {
        alert("Payment successful! Wallet credited with ₵" + amount);
        window.location.reload();
      }
    },
    onClose: function(){
      alert("Transaction cancelled");
    }
  });

  handler.openIframe();
}

function processFunding(){
  if(paymentMethod === "paystack"){
    payWithPaystack();
  } else {
    openManualModal();
  }
}

function openManualModal() {
  let amountInput = parseFloat(document.getElementById("amount").value);
  if(isNaN(amountInput) || amountInput <= 0) {
    alert("Please enter a valid amount first.");
    return;
  }

  // Generate Reference ID dynamically
  let randomChars = Math.random().toString(36).substring(2, 6).toUpperCase();
  document.getElementById("refId").innerText = "D4G-" + randomChars;
  
  // Show Modal
  document.getElementById("manualModal").style.display = "flex";
}

function closeManualModal() {
  document.getElementById("manualModal").style.display = "none";
}

async function submitManualRequest() {
  let amount = parseFloat(document.getElementById("amount").value);
  let refId = document.getElementById("refId").innerText;

  if(isNaN(amount) || amount <= 0) {
    alert("Invalid amount.");
    return;
  }

  const submitBtn = document.getElementById("submitManualBtn");
  submitBtn.disabled = true;
  submitBtn.innerText = "Submitting Request...";

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) {
      window.location.href = "login.html";
      return;
    }

    // Fetch user phone natively
    let { data: currUser } = await supabase
      .from("users")
      .select("phone")
      .eq("id", user.id)
      .single();

    // Insert pending transaction (balance remains untouched)
    await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        type: "Deposit (Manual)",
        amount: amount,
        status: "Pending",
        reference: refId
      });

    // Dispatch SMS Notification
    if(window.sendSmsNotification && currUser?.phone) {
      window.sendSmsNotification(currUser.phone, `Your manual funding request of ₵${amount} with Ref: ${refId} is pending review by our agents.`);
    }

    closeManualModal();
    
    if(window.showSuccessPopup) {
      window.showSuccessPopup("Request Submitted!", "Your manual funding request has been submitted. We will process it shortly.", () => {
        window.location.reload();
      });
    } else {
      alert("Manual funding request submitted successfully! We will process it shortly.");
      window.location.reload();
    }
    
  } catch (err) {
    alert("Failed to submit request.");
    console.error(err);
    submitBtn.disabled = false;
    submitBtn.innerText = "I Have Transferred The Funds";
  }
}
