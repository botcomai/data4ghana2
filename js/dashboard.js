// js/dashboard.js

// Load user data, wallet balance, and dashboard stats from Supabase
async function loadDashboardData() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if(error || !user){
    window.location.href="login.html";
    return;
  }

  // Populate user information from metadata
  const metadata = user.user_metadata || {};
  const firstName = metadata.first_name || "User";
  const lastName = metadata.last_name || "";
  const fullName = (firstName + " " + lastName).trim() || "User";

  const sidebarNameElem = document.getElementById("sidebarName");
  const welcomeMsgElem = document.getElementById("welcomeMessage");
  const userCardNameElem = document.getElementById("userCardName");

  if(sidebarNameElem) sidebarNameElem.innerText = firstName;
  if(welcomeMsgElem) welcomeMsgElem.innerText = "Welcome back, " + fullName + "!";
  if(userCardNameElem) userCardNameElem.innerText = fullName;

  // Load User Details
  let { data: userData } = await supabase
    .from("users")
    .select("wallet_balance, role")
    .eq("id", user.id)
    .single();

  if(userData){
    document.getElementById("walletBalance").innerText = "₵" + Number(userData.wallet_balance || 0).toFixed(2);

    // Dynamic role display
    const roleLabels = {
      'admin': 'ADMIN',
      'super_agent': 'SUPER AGENT',
      'elite_agent': 'ELITE AGENT',
      'vip_customer': 'VIP CUSTOMER',
      'client': 'CLIENT'
    };
    const roleColors = {
      'admin': '#ef4444',
      'super_agent': '#8b5cf6',
      'elite_agent': '#3b82f6',
      'vip_customer': '#f59e0b',
      'client': '#64748b'
    };
    const roleElem = document.getElementById("userRole");
    if(roleElem && userData.role) {
      roleElem.innerText = roleLabels[userData.role] || 'CLIENT';
      roleElem.style.color = roleColors[userData.role] || '#64748b';
    }
  }

  // Load Dashboard Stats
  loadDashboardStats(user.id);

  // Load Recent Transactions
  loadRecentTransactions(user.id);
}

async function loadDashboardStats(userId) {
  // Get today's date bounds in local time
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const startIso = startOfDay.toISOString();
  const endIso = endOfDay.toISOString();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("price, bundle")
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lte("created_at", endIso);

  if (error) {
    console.error("Error fetching orders:", error);
    return;
  }

  const ordersToday = orders.length;
  let amountToday = 0;
  let bundleToday = 0;

  orders.forEach(order => {
    amountToday += Number(order.price) || 0;
    if (order.bundle) {
      bundleToday += Number(order.bundle) || 0;
    }
  });

  const ordersElem = document.getElementById("ordersToday");
  const amountElem = document.getElementById("amountToday");
  const bundleElem = document.getElementById("bundleToday");

  if(ordersElem) ordersElem.innerText = ordersToday;
  if(amountElem) amountElem.innerText = "₵" + amountToday.toFixed(2);
  
  if(bundleElem) {
    let bundleText = bundleToday + "GB";
    if (bundleToday === 0) {
      bundleText = "0GB";
    } else if (bundleToday < 1) {
      bundleText = (bundleToday * 1000) + "MB";
    } else {
      bundleText = bundleToday.toFixed(1).replace(/\.0$/, '') + "GB";
    }
    bundleElem.innerText = bundleText;
  }
}

async function loadRecentTransactions(userId) {
  const listContainer = document.getElementById("recentTransactionsList");
  if (!listContainer) return;

  const { data: txData, error } = await supabase
    .from("transactions")
    .select("type, amount, status, created_at, reference")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching transactions:", error);
    listContainer.innerHTML = `<p style="text-align: center; color: #e74c3c; font-size: 14px; padding: 20px;">Failed to load transactions</p>`;
    return;
  }

  const transactions = txData || [];

  if (transactions.length === 0) {
    listContainer.innerHTML = `<p style="text-align: center; color: #64748b; font-size: 14px; padding: 20px;">No recent transactions</p>`;
    return;
  }

  listContainer.innerHTML = ""; // Clear loading message

  transactions.forEach(tx => {
    const txDiv = document.createElement("div");
    txDiv.className = "transaction";

    const dateStr = new Date(tx.created_at).toLocaleDateString('en-GB'); // dd/mm/yyyy

    const statusValue = tx.status ? tx.status.toLowerCase() : 'pending';
    let statusClass = 'pending';
    if (statusValue.includes('completed') || statusValue.includes('success')) {
      statusClass = 'success';
    }

    const typeDesc = tx.type || 'Transaction';
    
    // Check if it's a deposit/funding vs a purchase
    const isCredit = typeDesc.toLowerCase().includes('funding') || typeDesc.toLowerCase().includes('deposit');
    const sign = isCredit ? '+' : '-';
    
    const amountStr = `${sign}₵${Number(tx.amount || 0).toFixed(2)}`;

    const subText = tx.reference ? `Ref: ${tx.reference} · ${dateStr}` : `Date: ${dateStr}`;

    txDiv.innerHTML = `
      <div>
        <strong>${typeDesc}</strong>
        <p>${subText}</p>
      </div>
      <div class="right">
        <span>${amountStr}</span>
        <label class="${statusClass}">${tx.status || 'Pending'}</label>
      </div>
    `;

    listContainer.appendChild(txDiv);
  });
}

// Start Loading Process
loadDashboardData();
