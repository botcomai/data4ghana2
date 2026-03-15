let allOrders = [];

async function fetchOrders() {
  const { data: { user } } = await supabase.auth.getUser()

  if(!user){
    window.location.href="login.html"
    return
  }

  let { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  allOrders = data || [];
  renderOrders(allOrders);
}

function renderOrders(data) {
  let table = document.getElementById("ordersTable")
  table.innerHTML = ""

  if(!data || data.length === 0){
    table.innerHTML = `
    <tr class="empty">
      <td colspan="10">No orders found</td>
    </tr>
    `
    return
  }

  data.forEach(order => {
    let row = document.createElement("tr")
    
    // Convert status to a valid CSS class (e.g., "In transit" -> "in-transit")
    const statusClass = order.status ? order.status.toLowerCase().replace(/\s+/g, '-') : 'pending';

    row.innerHTML = `
      <td>${order.id}</td>
      <td><span class="status ${statusClass}">${order.status || 'Pending'}</span></td>
      <td>${order.phone || '-'}</td>
      <td>${order.bundle ? order.bundle + 'GB' : '-'}</td>
      <td>₵${order.price || '0'}</td>
      <td>${order.network || '-'}</td>
      <td>${order.api_reference || '-'}</td>
      <td>${order.status && order.status.toLowerCase() === 'completed' ? '<span style="color: #27ae60; font-weight: 600;">Yes</span>' : '<span style="color: #c0392b; font-weight: 600;">No</span>'}</td>
      <td>${new Date(order.created_at).toLocaleDateString()}</td>
      <td>
        <button class="view-btn" onclick="checkStatus('${order.phone || ''}', '${order.api_reference || ''}', this)">Check Status</button>
      </td>
    `
    table.appendChild(row)
  })
}


// ==========================================
// CHECK ORDER STATUS VIA DATA4GHANA API
// ==========================================
async function checkStatus(phone, reference, btnElement) {
  if (!phone && !reference) {
    alert("No phone number or reference available to check status.");
    return;
  }

  // Show loading state
  const originalText = btnElement.innerText;
  btnElement.innerText = "Checking...";
  btnElement.disabled = true;

  try {
    if (window.checkOrderStatus) {
      const result = await checkOrderStatus(phone || null, reference || null);
      
      if (result.success) {
        const statusData = result.data;
        let statusMsg = "Status: " + JSON.stringify(statusData, null, 2);
        
        // Try to extract meaningful status info
        if (statusData.status) {
          statusMsg = `Status: ${statusData.status}`;
          if (statusData.reference) statusMsg += `\nRef: ${statusData.reference}`;
          if (statusData.message) statusMsg += `\n${statusData.message}`;
        }

        alert(statusMsg);
        
        // If we got a status update, refresh the orders
        fetchOrders();
      } else {
        alert("Status check failed: " + (result.error || "Unknown error"));
      }
    } else {
      alert("API service not available. Please reload the page.");
    }
  } catch(err) {
    console.error("Status check error:", err);
    alert("Failed to check order status.");
  }

  // Restore button
  btnElement.innerText = originalText;
  btnElement.disabled = false;
}


function applyFilters() {
  const searchVal = document.getElementById("searchOrder").value.toLowerCase();
  const statusVal = document.getElementById("statusFilter").value;
  const dateVal = document.getElementById("dateFilter").value;
  const phoneVal = document.getElementById("phoneFilter").value;

  let filtered = allOrders.filter(order => {
    let match = true;
    
    // Search by ID or Product (Network/Bundle logic fallback)
    if (searchVal) {
      const searchTarget = `${order.id} ${order.network} ${order.bundle} ${order.api_reference || ''}`.toLowerCase();
      match = match && searchTarget.includes(searchVal);
    }
    
    // Filter by Exact Status
    if (statusVal) {
      match = match && (order.status && order.status.toLowerCase() === statusVal.toLowerCase());
    }
    
    // Filter by Exact Date Formatted
    if (dateVal) {
      if(order.created_at) {
        const orderDate = new Date(order.created_at).toISOString().split('T')[0];
        match = match && (orderDate === dateVal);
      } else {
        match = false; // If no date on record, drop it from results
      }
    }
    
    // Filter by Phone
    if (phoneVal) {
      match = match && (order.phone && String(order.phone).includes(phoneVal));
    }
    
    return match;
  });

  renderOrders(filtered);
}

// Attach Event Listeners to all 4 inputs
document.getElementById("searchOrder").addEventListener("input", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);
document.getElementById("dateFilter").addEventListener("change", applyFilters);
document.getElementById("phoneFilter").addEventListener("input", applyFilters);

// Initial Load
fetchOrders()
