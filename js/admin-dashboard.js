// ==========================================
// ADMIN HQ: CORE LOGIC
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verify Authorization immediately (double lock)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = "admin-login.html";
        return;
    }

    const { data: dbData } = await supabase.from('users').select('role').eq('id', user.id).single();
    const allowedAdminRoles = ['admin', 'super_agent'];
    if (!dbData || !allowedAdminRoles.includes(dbData.role)) {
        window.location.href = "admin-login.html";
        return;
    }

    // Store admin role for permission checks
    window.adminRole = dbData.role;

    // Clearance verified. Load the first tab.
    loadOverviewStats();
});

function adminLogout() {
    supabase.auth.signOut().then(() => {
        window.location.href = "admin-login.html";
    });
}

function switchTab(tabId) {
    // Update Nav UI
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Update Panes
    document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');

    // Load Data
    switch(tabId) {
        case 'overview':
            loadOverviewStats();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'manual':
            loadManualFunding();
            break;
        case 'support':
            loadSupportTickets();
            break;
        case 'users':
            loadUsers();
            break;
        case 'pricing':
            loadPricingConfig();
            break;
        case 'afa':
            loadAfa();
            break;
        case 'api':
            loadApiKeys();
            break;
        case 'profit':
            loadProfitReport();
            break;
    }
}

function hardRefresh() {
    // Determine active tab and force a refresh of the DB queries
    if(document.getElementById('tab-overview').classList.contains('active')) return loadOverviewStats();
    if(document.getElementById('tab-orders').classList.contains('active')) return loadOrders();
    if(document.getElementById('tab-manual').classList.contains('active')) return loadManualFunding();
    if(document.getElementById('tab-support').classList.contains('active')) return loadSupportTickets();
    if(document.getElementById('tab-users').classList.contains('active')) return loadUsers();
}

// ==========================================
// TAB 0: OVERVIEW ANALYTICS
// ==========================================
async function loadOverviewStats() {
    
    // Setup Today's ISO Timeline string for > Operations
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfTodayISO = today.toISOString();

    // 1. Total Users
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
    document.getElementById("metric-users").innerText = userCount || 0;

    // 2. Lifetime Transactions (Wallet Fundings)
    // We'll calculate the sum logic by pulling completed transactions
    const { data: txData } = await supabase.from('transactions').select('amount').eq('status', 'completed');
    let totalLifeTx = 0;
    if(txData) {
        txData.forEach(tx => totalLifeTx += parseFloat(tx.amount || 0));
    }
    document.getElementById("metric-tx").innerText = "₵" + totalLifeTx.toFixed(2);

    // 3. Today's Revenue (Processing sum of today's completed funding)
    const { data: todayTxData } = await supabase.from('transactions')
        .select('amount')
        .eq('status', 'completed')
        .gte('created_at', startOfTodayISO);
    
    let totalSalesToday = 0;
    if(todayTxData) {
        todayTxData.forEach(tx => totalSalesToday += parseFloat(tx.amount || 0));
    }
    document.getElementById("metric-sales").innerText = "₵" + totalSalesToday.toFixed(2);

    // 4. Today's Bundle Orders (Count)
    const { count: orderCountToday } = await supabase.from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfTodayISO);
    document.getElementById("metric-orders").innerText = orderCountToday || 0;

    // 5. Recent Resgistrations Table Mini-view
    const tbody = document.getElementById("overviewRecentUsersBody");
    tbody.innerHTML = `<tr><td colspan="4" class="state-msg">Fetching newest users...</td></tr>`;

    const { data: recentUsers } = await supabase
        .from('users')
        .select('first_name, last_name, email, phone, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if(!recentUsers || recentUsers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="state-msg">No recent registrations found.</td></tr>`;
        return;
    }

    let html = '';
    recentUsers.forEach(u => {
        const d = new Date(u.created_at).toLocaleDateString();
        html += `
            <tr>
                <td><strong>${u.first_name || ''} ${u.last_name || ''}</strong></td>
                <td>${u.email}</td>
                <td>${u.phone || 'N/A'}</td>
                <td style="font-size:12px; color:#64748b;">${d}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==========================================
// TAB 1: ADVANCED DATA ORDERS
// ==========================================
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
const ROWS_PER_PAGE = 50;

async function loadOrders() {
    const tbody = document.getElementById("ordersTableBody");
    tbody.innerHTML = `<tr><td colspan="7" class="state-msg">Fetching complete network orders matrix...</td></tr>`;

    // Fetch up to 5000 orders to allow local filtering
    const { data, error } = await supabase
        .from('orders')
        .select('*, users(email)')
        .order('created_at', { ascending: false })
        .limit(5000);

    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="state-msg" style="color:red!important;">Error: ${error.message}</td></tr>`;
        return;
    }

    allOrders = data || [];
    applyOrderFilters(); // Initial render
}

function applyOrderFilters() {
    const sPhone = document.getElementById("filterPhone").value.toLowerCase();
    const sDateFrom = document.getElementById("filterDateFrom").value;
    const sDateTo = document.getElementById("filterDateTo").value;
    const sStatus = document.getElementById("filterStatus").value;
    const sProduct = document.getElementById("filterProduct").value;

    filteredOrders = allOrders.filter(o => {
        let match = true;
        
        // 1. Phone match
        if(sPhone && !o.phone.includes(sPhone)) match = false;
        
        // 2. Status match
        if(sStatus !== "" && String(o.status) !== sStatus) match = false;
        
        // 3. Product match
        if(sProduct !== "" && o.network !== sProduct) match = false;

        // 4. Date Range
        if(match && (sDateFrom || sDateTo)) {
            const orderDate = new Date(o.created_at);
            if(sDateFrom) {
                const fromD = new Date(sDateFrom);
                fromD.setHours(0,0,0,0);
                if(orderDate < fromD) match = false;
            }
            if(sDateTo) {
                const toD = new Date(sDateTo);
                toD.setHours(23,59,59,999);
                if(orderDate > toD) match = false;
            }
        }
        return match;
    });

    document.getElementById("totalResultsCounter").innerText = filteredOrders.length;
    currentPage = 1;
    renderOrdersPage(1);
}

function renderOrdersPage(page) {
    currentPage = page;
    const tbody = document.getElementById("ordersTableBody");
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="state-msg">Zero orders match these advanced filters.</td></tr>`;
        document.getElementById("orderPagination").innerHTML = "";
        return;
    }

    // Uncheck master toggle
    document.getElementById("selectAllOrders").checked = false;
    document.getElementById("selectCounter").innerText = "0";

    const startIndex = (page - 1) * ROWS_PER_PAGE;
    const endIndex = startIndex + ROWS_PER_PAGE;
    const pageData = filteredOrders.slice(startIndex, endIndex);

    let html = '';
    pageData.forEach(o => {
        const d = new Date(o.created_at).toLocaleString();
        const statLabel = String(o.status) === 'true' 
            ? '<span class="status-badge status-approved">COMPLETED</span>' 
            : '<span class="status-badge status-false">PENDING</span>';
        
        const userEmail = o.users?.email || 'Unknown';
        
        html += `
            <tr data-id="${o.id}">
                <td><input type="checkbox" class="order-checkbox" value="${o.id}" onclick="updateSelectCount()" data-phone="${o.phone}" data-vol="${o.plan}"></td>
                <td style="font-family:monospace; color:#64748b; font-size:12px;">${o.id.substring(0,8)}...</td>
                <td>
                    <div style="font-size:11px; color:#64748b;">User: ${userEmail}</div>
                    <div style="font-weight:700; color:#0f172a;">Rec: ${o.phone}</div>
                </td>
                <td>
                    <div style="font-size:11px; font-weight:700; color:#4f46e5;">${o.network}</div>
                    <div style="font-weight:600;">${o.plan}</div>
                </td>
                <td><strong>₵${parseFloat(o.amount||0).toFixed(2)}</strong></td>
                <td>${statLabel}</td>
                <td style="font-size:12px; color:#64748b;">${d}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;

    // Build Pagination
    const totalPages = Math.ceil(filteredOrders.length / ROWS_PER_PAGE);
    let pagHtml = '';
    for(let i=1; i<=totalPages; i++) {
        pagHtml += `<button class="refresh-btn" style="${i===page ? 'background:#3b82f6; color:white; border-color:#3b82f6;' : ''}" onclick="renderOrdersPage(${i})">${i}</button>`;
    }
    document.getElementById("orderPagination").innerHTML = pagHtml;
}

function toggleAllOrders(source) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateSelectCount();
}

function updateSelectCount() {
    const checkedLength = document.querySelectorAll('.order-checkbox:checked').length;
    document.getElementById("selectCounter").innerText = checkedLength;
}

function autoSelectRows() {
    const count = parseInt(document.getElementById("autoSelectCount").value) || 0;
    const checkboxes = document.querySelectorAll('.order-checkbox');
    
    checkboxes.forEach(cb => cb.checked = false); // clear first
    
    let selected = 0;
    for(let i=0; i<checkboxes.length; i++) {
        if(selected >= count) break;
        checkboxes[i].checked = true;
        selected++;
    }
    updateSelectCount();
}

async function massUpdateSelected() {
    const checked = document.querySelectorAll('.order-checkbox:checked');
    if(checked.length === 0) return alert("Select at least one order to fulfill.");
    
    if(!confirm(`Are you sure you want to MASS FULFILL ${checked.length} orders? Triggers SMS to all.`)) return;

    let idsToUpdate = [];
    checked.forEach(cb => idsToUpdate.push(cb.value));

    // Update massively
    const { error } = await supabase.from('orders').update({ status: 'true' }).in('id', idsToUpdate);
    
    if(error) {
        alert("Mass Update Error: " + error.message);
    } else {
        alert(`Successfully marked ${checked.length} orders as COMPLETED.`);
        loadOrders();
    }
}

function exportSelectedToExcel() {
    const checked = document.querySelectorAll('.order-checkbox:checked');
    if(checked.length === 0) return alert("Select at least one order to export.");

    let csvContent = "Recipient Number,Data Volume (Raw)\n";

    checked.forEach(cb => {
        const phone = cb.getAttribute('data-phone');
        const rawVol = cb.getAttribute('data-vol');
        
        // Strip text: "10GB" -> "10", "1.5 GB" -> "1.5"
        const cleanVol = rawVol.replace(/[^0-9.]/g, '');
        
        csvContent += `${phone},${cleanVol}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Data4Ghana_Orders_Export_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// AUTO-FULFILL ORDER VIA DATA4GHANA API
// ==========================================
async function apiFulfillOrder(orderId) {
    if(!confirm("Auto-fulfill this order via Data4Ghana API? This will send the data bundle directly to the customer's phone.")) return;

    // 1. Get order details
    const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

    if (error || !order) {
        alert("Failed to load order details.");
        return;
    }

    // 2. Map network name for API
    const networkMap = {
        'MTN': 'MTN',
        'Telecel': 'Telecel',
        'Ishare': 'AirtelTigo',
        'AirtelTigo': 'AirtelTigo',
        'Bigtime': 'AirtelTigo',
    };
    const apiNetwork = networkMap[order.network] || order.network;
    const dataSize = (order.bundle || order.plan) + "GB";

    // 3. Call the Edge Function
    try {
        const SUPABASE_FUNCTIONS_URL = "https://wynmejzsybkxhqvazjzu.supabase.co/functions/v1";
        const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/place-data-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                network: apiNetwork,
                phone: order.phone,
                data_size: dataSize,
            }),
        });

        const result = await response.json();

        if (result.success) {
            // Update order with API reference and mark as completed
            await supabase.from('orders').update({
                status: 'true',
                api_reference: result.data?.reference || result.data?.order_id || 'API_OK',
                api_response: JSON.stringify(result.data),
            }).eq('id', orderId);

            alert(`✅ Order fulfilled via API! Ref: ${result.data?.reference || 'N/A'}`);
        } else {
            alert(`❌ API fulfillment failed: ${result.error || 'Unknown error'}. You can still fulfill manually.`);
        }
    } catch(err) {
        alert(`❌ Network error: ${err.message}. You can still fulfill manually.`);
    }

    loadOrders();
}

// ==========================================
// TAB 6: AFA REGISTRATIONS
// ==========================================
async function loadAfa() {
    const tbody = document.getElementById("afaTableBody");
    tbody.innerHTML = `<tr><td colspan="6" class="state-msg">Syncing AFA applications...</td></tr>`;

    const { data, error } = await supabase
        .from('afa_registrations')
        .select('*, users(email)')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="state-msg" style="color:red!important;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="state-msg">No AFA registrations pending.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(r => {
        const d = new Date(r.created_at).toLocaleDateString();
        const userEmail = r.users?.email || 'Unknown User';
        
        // Tier Badge
        const tierBadge = r.tier === 'premium' 
            ? '<span class="status-badge" style="background:#fef3c7; color:#d97706;">PREMIUM AFA</span>'
            : '<span class="status-badge" style="background:#e0f2fe; color:#0284c7;">NORMAL AFA</span>';

        // Status Badge
        let statBadge = '';
        let actBtns = '';
        if(r.status === 'pending') {
            statBadge = '<span class="status-badge status-checking">PENDING</span>';
            actBtns = `
                <button class="action-btn btn-approve" onclick="updateAfaStatus('${r.id}', 'approved', '${userEmail}')" style="margin-right:5px;">Approve</button>
                <button class="action-btn" onclick="updateAfaStatus('${r.id}', 'rejected', '${userEmail}')" style="background:#ef4444; color:white;">Reject</button>
            `;
        } else if(r.status === 'approved') {
            statBadge = '<span class="status-badge status-approved">APPROVED</span>';
            actBtns = `<span style="font-size:12px; color:#64748b; font-style:italic;">Resolved</span>`;
        } else {
            statBadge = '<span class="status-badge status-false">REJECTED</span>';
            actBtns = `<span style="font-size:12px; color:#64748b; font-style:italic;">Resolved</span>`;
        }

        html += `
            <tr>
                <td style="font-weight:600; color:#0f172a;">${userEmail}</td>
                <td>${tierBadge}</td>
                <td>${r.phone}</td>
                <td>${statBadge}</td>
                <td style="font-size:12px; color:#64748b;">${d}</td>
                <td style="white-space:nowrap;">${actBtns}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function updateAfaStatus(id, newStatus, email) {
    if(!confirm(`Are you sure you want to mark this request from ${email} as ${newStatus.toUpperCase()}?`)) return;

    const { error } = await supabase.from('afa_registrations').update({ status: newStatus }).eq('id', id);
    if(error) {
        alert("AFA Update Error: " + error.message);
    } else {
        alert(`AFA Request successfully marked as ${newStatus}.`);
        loadAfa();
    }
}

// ==========================================
// TAB 8: API KEYS (MERCHANTS)
// ==========================================
async function loadApiKeys() {
    const tbody = document.getElementById("apiTableBody");
    tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Syncing security keys...</td></tr>`;

    const { data, error } = await supabase
        .from('api_keys')
        .select('*, users(email)')
        .order('created_at', { ascending: false });

    if (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-msg" style="color:red!important;">Error: ${error.message}</td></tr>`;
        return;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-msg">No developers have generated API keys.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(k => {
        const d = new Date(k.created_at).toLocaleString();
        const userEmail = k.users?.email || 'Unknown';
        
        // Status Badge
        const statBadge = k.status === 'active' 
            ? '<span class="status-badge status-approved">ACTIVE KEY</span>'
            : '<span class="status-badge status-false">REVOKED (DEAD)</span>';

        const actBtns = k.status === 'active'
            ? `<button class="action-btn" onclick="revokeApiKey('${k.id}')" style="background:#ef4444; color:white;">Revoke Access</button>`
            : `<span style="font-size:12px; color:#64748b;">Action Disabled</span>`;

        html += `
            <tr>
                <td style="font-family:monospace; color:#0f172a; font-weight:700;">${k.merchant_id}</td>
                <td><div style="font-size:12px; color:#64748b;">Owner</div><div style="font-weight:600;">${userEmail}</div></td>
                <td>${statBadge}</td>
                <td style="font-size:12px; color:#64748b;">${d}</td>
                <td>${actBtns}</td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function revokeApiKey(id) {
    if(!confirm("DANGER: Are you sure you want to terminate this Merchant's API Key? This will instantly break their web/app integrations connected to Data4Ghana.")) return;

    const { error } = await supabase.from('api_keys').update({ status: 'revoked' }).eq('id', id);
    if(error) {
        alert("Revocation Error: " + error.message);
    } else {
        alert("SECURITY TRIGGERED: API Key successfully revoked and killed.");
        loadApiKeys();
    }
}

// ==========================================
// TAB 2: MANUAL FUNDING
// ==========================================
async function loadManualFunding() {
    const tbody = document.getElementById("manualTableBody");
    tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Fetching manual transfers...</td></tr>`;

    // Fetch pending manual transfers
    const { data, error } = await supabase
        .from('transactions')
        .select('*, users(email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Zero manual transfers awaiting approval.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(t => {
        const d = new Date(t.created_at).toLocaleString();
        html += `
            <tr>
                <td style="font-family:monospace; color:#64748b;">${t.id.substring(0,8)}...</td>
                <td>${t.users?.email || 'Unknown User'}</td>
                <td><strong style="color:#059669;">₵ ${t.amount}</strong></td>
                <td style="font-size:12px;">${d}</td>
                <td>
                    <button class="action-btn btn-approve" onclick="approveFunding('${t.id}', '${t.user_id}', ${t.amount})">Approve Credit</button>
                    <button class="action-btn btn-reject" onclick="rejectFunding('${t.id}')">Reject</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function approveFunding(txId, userId, amount) {
    if(!confirm(`Approve adding ₵${amount} to this user's wallet?`)) return;

    // 1. Mark transaction as completed
    await supabase.from('transactions').update({ status: 'completed' }).eq('id', txId);
    
    // 2. Safely read current wallet balance
    const { data: u } = await supabase.from('users').select('wallet_balance').eq('id', userId).single();
    const newBal = (parseFloat(u.wallet_balance || 0) + parseFloat(amount)).toFixed(2);
    
    // 3. Update User's balance completely
    await supabase.from('users').update({ wallet_balance: newBal }).eq('id', userId);
    
    alert("Funds successfully deposited to user wallet.");
    loadManualFunding();
}

async function rejectFunding(txId) {
    if(!confirm("Are you sure you want to reject this manual transfer constraint?")) return;
    await supabase.from('transactions').update({ status: 'failed' }).eq('id', txId);
    loadManualFunding();
}

// ==========================================
// TAB 3: SUPPORT TICKETS
// ==========================================
async function loadSupportTickets() {
    const tbody = document.getElementById("supportTableBody");
    tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Fetching active support tickets...</td></tr>`;

    // Fetch tickets that still need reviewing
    const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('status', 'checking')
        .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Zero active support tickets. The queue is completely clear.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(t => {
        // Build screenshot URL
        const { data: publicUrlData } = supabase.storage.from('support_media').getPublicUrl(t.screenshot_url);
        const imgUrl = publicUrlData.publicUrl;

        html += `
            <tr>
                <td style="font-family:monospace; color:#64748b;">${t.id.substring(0,8)}</td>
                <td><strong>${t.phone_number}</strong></td>
                <td style="max-width:300px;">${t.issue_description}</td>
                <td>
                    <button class="action-btn btn-view" onclick="openImageModal('${imgUrl}')">View Image</button>
                </td>
                <td>
                    <button class="action-btn btn-approve" onclick="resolveTicket('${t.id}', 'approved')">Approve Issue</button>
                    <button class="action-btn btn-reject" onclick="resolveTicket('${t.id}', 'false')">Mark Invalid</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function resolveTicket(ticketId, finalStatus) {
    if(!confirm(`Are you sure you want to mark this ticket as ${finalStatus.toUpperCase()}? This will text the user's phone.`)) return;
    
    // Changing the status will trigger the public.trigger_ticket_sms Postgres function!
    await supabase.from('support_tickets').update({ status: finalStatus }).eq('id', ticketId);
    loadSupportTickets();
}

// Image Modal Logic
function openImageModal(imgSrc) {
    document.getElementById("modalImg").src = imgSrc;
    document.getElementById("imageModal").style.display = "block";
}
function closeModal() {
    document.getElementById("imageModal").style.display = "none";
}

// ==========================================
// TAB 4: USERS DATABASE
// ==========================================
async function loadUsers() {
    const tbody = document.getElementById("usersTableBody");
    tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Syncing User Database...</td></tr>`;

    const { data, error } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, phone, wallet_balance, role')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error || !data) {
        tbody.innerHTML = `<tr><td colspan="5" class="state-msg">Database failure.</td></tr>`;
        return;
    }

    let html = '';
    data.forEach(u => {
        // Build dynamic role selector
        const roleStr = u.role || 'client';
        const selectMenu = `
            <select class="admin-input" style="padding:4px; font-size:12px; width:110px;" onchange="updateUserRole('${u.id}', this.value)">
                <option value="client" ${roleStr === 'client' ? 'selected' : ''}>Client</option>
                <option value="elite_agent" ${roleStr === 'elite_agent' ? 'selected' : ''}>Elite Agent</option>
                <option value="super_agent" ${roleStr === 'super_agent' ? 'selected' : ''}>Super Agent</option>
                <option value="admin" ${roleStr === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
        `;

        html += `
            <tr>
                <td><strong>${u.first_name || ''} ${u.last_name || ''}</strong></td>
                <td>${u.email}</td>
                <td>${u.phone || 'N/A'}</td>
                <td><strong>₵ ${parseFloat(u.wallet_balance || 0).toFixed(2)}</strong></td>
                <td>${selectMenu}</td>
                <td style="white-space:nowrap;">
                    <button onclick="openWalletModal('${u.email}', '${(u.first_name || '').replace(/'/g, "\\'")} ${(u.last_name || '').replace(/'/g, "\\'")}', ${u.wallet_balance || 0})" style="padding:5px 10px; border:1px solid #10b981; background:rgba(16,185,129,0.1); color:#10b981; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer; margin-right:4px;" title="Credit or Debit wallet">💳</button>
                    <button onclick="openTxModal('${u.email}', '${(u.first_name || '').replace(/'/g, "\\'")} ${(u.last_name || '').replace(/'/g, "\\'")}' )" style="padding:5px 10px; border:1px solid #3b82f6; background:rgba(59,130,246,0.1); color:#3b82f6; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;" title="View transactions">📋</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// ==========================================
// UPDATE USER ROLE (called by inline onchange in Users tab)
// ==========================================
async function updateUserRole(userId, newRole) {
    if (!confirm(`Change this user's role to ${newRole.toUpperCase().replace(/_/g, ' ')}?`)) {
        loadUsers(); // re-render to revert the dropdown visual state
        return;
    }

    try {
        // Prefer the secure SECURITY DEFINER RPC (validates admin server-side)
        const { error: rpcError } = await supabase.rpc('admin_update_role', {
            target_user_id: userId,
            new_role: newRole
        });

        if (rpcError) {
            // RPC may not exist yet — fall back to direct update (still protected by RLS)
            const { error: directError } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId);
            if (directError) throw directError;
        }

        alert(`✅ Role updated to ${newRole.toUpperCase().replace(/_/g, ' ')}`);
        loadUsers();
    } catch(e) {
        alert('Failed to update role: ' + e.message);
        loadUsers();
    }
}

// ==========================================
// CHANGE USER ROLE (legacy — kept for compatibility)
// ==========================================
async function changeUserRole(email, newRole) {
    if (window.adminRole !== 'admin') {
        alert('Only admins can change user roles.');
        loadUsers();
        return;
    }

    if (!confirm(`Change this user's role to ${newRole.toUpperCase().replace(/_/g, ' ')}?`)) {
        loadUsers();
        return;
    }

    try {
        const { error } = await supabase
            .from('users')
            .update({ role: newRole })
            .eq('email', email);

        if (error) throw error;
        alert(`✅ Role updated to ${newRole.toUpperCase().replace(/_/g, ' ')}`);
        loadUsers();
    } catch(e) {
        alert('Failed to update role: ' + e.message);
        loadUsers();
    }
}

// ==========================================
// CREDIT / DEBIT USER WALLET
// ==========================================
let walletModalEmail = '';
let walletModalBalance = 0;
let walletAction = 'credit';

function openWalletModal(email, name, currentBalance) {
    walletModalEmail = email;
    walletModalBalance = parseFloat(currentBalance) || 0;
    walletAction = 'credit';

    document.getElementById('walletModalUser').innerHTML = `<strong>${name.trim()}</strong> · ${email}<br>Current Balance: <strong>₵${walletModalBalance.toFixed(2)}</strong>`;
    document.getElementById('walletAmount').value = '';
    document.getElementById('walletReason').value = '';
    setWalletAction('credit');
    document.getElementById('walletModal').style.display = 'flex';
}

function closeWalletModal() {
    document.getElementById('walletModal').style.display = 'none';
}

function setWalletAction(action) {
    walletAction = action;
    const creditBtn = document.getElementById('creditTabBtn');
    const debitBtn = document.getElementById('debitTabBtn');
    const submitBtn = document.getElementById('walletSubmitBtn');

    if (action === 'credit') {
        creditBtn.style.border = '2px solid #10b981';
        creditBtn.style.background = 'rgba(16,185,129,0.1)';
        creditBtn.style.color = '#10b981';
        debitBtn.style.border = '2px solid #e2e8f0';
        debitBtn.style.background = 'white';
        debitBtn.style.color = '#64748b';
        submitBtn.style.background = '#10b981';
        submitBtn.innerText = 'Confirm Credit';
    } else {
        debitBtn.style.border = '2px solid #ef4444';
        debitBtn.style.background = 'rgba(239,68,68,0.1)';
        debitBtn.style.color = '#ef4444';
        creditBtn.style.border = '2px solid #e2e8f0';
        creditBtn.style.background = 'white';
        creditBtn.style.color = '#64748b';
        submitBtn.style.background = '#ef4444';
        submitBtn.innerText = 'Confirm Debit';
    }
}

async function submitWalletAction() {
    const amount = parseFloat(document.getElementById('walletAmount').value);
    const reason = document.getElementById('walletReason').value.trim() || (walletAction === 'credit' ? 'Admin Credit' : 'Admin Debit');

    if (!amount || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }

    if (walletAction === 'debit' && amount > walletModalBalance) {
        alert(`Cannot debit ₵${amount.toFixed(2)} — user only has ₵${walletModalBalance.toFixed(2)}`);
        return;
    }

    const newBalance = walletAction === 'credit'
        ? walletModalBalance + amount
        : walletModalBalance - amount;

    const actionLabel = walletAction === 'credit' ? 'Credit' : 'Debit';
    if (!confirm(`${actionLabel} ₵${amount.toFixed(2)} ${walletAction === 'credit' ? 'to' : 'from'} this user?\n\nNew balance: ₵${newBalance.toFixed(2)}\nReason: ${reason}`)) {
        return;
    }

    try {
        // Get user ID from email
        const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('id')
            .eq('email', walletModalEmail)
            .single();

        if (userErr || !userData) throw new Error('User not found');

        // Update wallet balance
        const { error: updateErr } = await supabase
            .from('users')
            .update({ wallet_balance: newBalance })
            .eq('id', userData.id);

        if (updateErr) throw updateErr;

        // Record the transaction
        await supabase
            .from('transactions')
            .insert({
                user_id: userData.id,
                type: `Admin ${actionLabel}`,
                amount: amount,
                balance_before: walletModalBalance,
                balance_after: newBalance,
                status: 'Completed',
                reference: `ADMIN_${walletAction.toUpperCase()}_${Date.now()}`
            });

        alert(`✅ ${actionLabel} of ₵${amount.toFixed(2)} applied. New balance: ₵${newBalance.toFixed(2)}`);
        closeWalletModal();
        loadUsers();
    } catch(e) {
        alert('Failed: ' + e.message);
    }
}

// ==========================================
// VIEW USER TRANSACTIONS
// ==========================================
async function openTxModal(email, name) {
    document.getElementById('txModalTitle').innerHTML = `📋 Transactions — <strong>${name.trim()}</strong>`;
    document.getElementById('txModalBody').innerHTML = '<p style="color:#94a3b8;">Loading transactions...</p>';
    document.getElementById('txModal').style.display = 'flex';

    try {
        // Get user ID
        const { data: userData } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (!userData) {
            document.getElementById('txModalBody').innerHTML = '<p style="color:#ef4444;">User not found.</p>';
            return;
        }

        // Fetch last 50 transactions
        const { data: txns, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userData.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        if (!txns || txns.length === 0) {
            document.getElementById('txModalBody').innerHTML = '<p style="color:#94a3b8; text-align:center; padding:30px;">No transactions found for this user.</p>';
            return;
        }

        let html = `<table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
                <tr style="border-bottom:2px solid #e2e8f0; text-align:left;">
                    <th style="padding:8px 6px; color:#64748b;">Date</th>
                    <th style="padding:8px 6px; color:#64748b;">Type</th>
                    <th style="padding:8px 6px; color:#64748b;">Amount</th>
                    <th style="padding:8px 6px; color:#64748b;">Before</th>
                    <th style="padding:8px 6px; color:#64748b;">After</th>
                    <th style="padding:8px 6px; color:#64748b;">Status</th>
                    <th style="padding:8px 6px; color:#64748b;">Ref</th>
                </tr>
            </thead><tbody>`;

        txns.forEach(tx => {
            const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : 'N/A';
            const isCredit = (tx.type || '').toLowerCase().includes('credit') || (tx.type || '').toLowerCase().includes('fund');
            const amtColor = isCredit ? '#10b981' : '#ef4444';
            const amtPrefix = isCredit ? '+' : '-';

            const statusColors = {
                'Completed': '#10b981', 'completed': '#10b981',
                'Pending': '#f59e0b', 'pending': '#f59e0b',
                'Failed': '#ef4444', 'failed': '#ef4444',
            };
            const sColor = statusColors[tx.status] || '#64748b';

            html += `<tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px 6px; white-space:nowrap;">${date}</td>
                <td style="padding:8px 6px;">${tx.type || 'N/A'}</td>
                <td style="padding:8px 6px; color:${amtColor}; font-weight:700;">${amtPrefix}₵${parseFloat(tx.amount || 0).toFixed(2)}</td>
                <td style="padding:8px 6px;">₵${parseFloat(tx.balance_before || 0).toFixed(2)}</td>
                <td style="padding:8px 6px;">₵${parseFloat(tx.balance_after || 0).toFixed(2)}</td>
                <td style="padding:8px 6px;"><span style="padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700; background:${sColor}15; color:${sColor};">${tx.status || 'N/A'}</span></td>
                <td style="padding:8px 6px; font-size:10px; color:#94a3b8;">${tx.reference || '—'}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        document.getElementById('txModalBody').innerHTML = html;

    } catch(e) {
        document.getElementById('txModalBody').innerHTML = `<p style="color:#ef4444;">Error: ${e.message}</p>`;
    }
}

function closeTxModal() {
    document.getElementById('txModal').style.display = 'none';
}

// ==========================================
// DATA4GHANA API TOGGLE MANAGEMENT
// ==========================================
async function loadApiToggleState() {
    try {
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'api_auto_order')
            .single();

        if (data) {
            const isOn = data.value === 'true';
            const toggle = document.getElementById('apiAutoOrderToggle');
            const knob = document.getElementById('apiToggleKnob');
            const badge = document.getElementById('apiStatusBadge');

            toggle.checked = isOn;
            
            if (isOn) {
                knob.style.transform = 'translateX(24px)';
                knob.parentElement.previousElementSibling.style.backgroundColor = '#10b981';
                badge.innerText = 'LIVE';
                badge.style.background = 'rgba(16,185,129,0.15)';
                badge.style.color = '#10b981';
            } else {
                knob.style.transform = 'translateX(0)';
                knob.parentElement.previousElementSibling.style.backgroundColor = '#475569';
                badge.innerText = 'OFFLINE';
                badge.style.background = 'rgba(239,68,68,0.15)';
                badge.style.color = '#ef4444';
            }
        }
    } catch(e) {
        console.error('Failed to load API toggle state:', e);
    }
}

async function toggleApiAutoOrder(isOn) {
    const knob = document.getElementById('apiToggleKnob');
    const badge = document.getElementById('apiStatusBadge');
    const toggleBg = knob.parentElement.previousElementSibling;

    // Optimistic UI update
    if (isOn) {
        knob.style.transform = 'translateX(24px)';
        toggleBg.style.backgroundColor = '#10b981';
        badge.innerText = 'LIVE';
        badge.style.background = 'rgba(16,185,129,0.15)';
        badge.style.color = '#10b981';
    } else {
        knob.style.transform = 'translateX(0)';
        toggleBg.style.backgroundColor = '#475569';
        badge.innerText = 'OFFLINE';
        badge.style.background = 'rgba(239,68,68,0.15)';
        badge.style.color = '#ef4444';
    }

    // Persist to database
    try {
        const { error } = await supabase
            .from('app_settings')
            .upsert({
                key: 'api_auto_order',
                value: isOn ? 'true' : 'false',
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) throw error;
    } catch(e) {
        alert('Failed to save API setting: ' + e.message);
        // Revert the toggle
        document.getElementById('apiAutoOrderToggle').checked = !isOn;
        loadApiToggleState();
    }
}

