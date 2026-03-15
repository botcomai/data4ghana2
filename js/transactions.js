let allTransactions = [];

async function fetchTransactions() {
  const { data: { user } } = await supabase.auth.getUser()

  if(!user){
    window.location.href="login.html"
    return
  }

  let { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  allTransactions = data || [];
  renderTransactions(allTransactions);
}

function renderTransactions(data) {
  let table = document.getElementById("transactionsTable")
  table.innerHTML = ""

  if(!data || data.length === 0){
    table.innerHTML = `
    <tr class="empty">
      <td colspan="8">No transactions found</td>
    </tr>
    `
    return
  }

  data.forEach(tx => {
    let row = document.createElement("tr")
    
    // Convert status to a valid CSS class (e.g., "completed" -> "completed")
    const statusClass = tx.status ? tx.status.toLowerCase().replace(/\s+/g, '-') : 'pending';

    row.innerHTML = `
      <td><strong>${tx.type || '-'}</strong></td>
      <td>₵${tx.amount || '0'}</td>
      <td>₵${tx.balance_before ?? '0'}</td>
      <td>₵${tx.balance_after ?? '0'}</td>
      <td><span class="status ${statusClass}">${tx.status || 'Pending'}</span></td>
      <td>${tx.reference || '-'}</td>
      <td>${new Date(tx.created_at).toLocaleDateString()}</td>
      <td><button class="view-btn">View</button></td>
    `
    table.appendChild(row)
  })
}

function applyFilters() {
  const searchVal = document.getElementById("searchInput").value.toLowerCase();
  const typeVal = document.getElementById("typeFilter").value;
  const statusVal = document.getElementById("statusFilter").value;
  const dateVal = document.getElementById("dateFilter").value;

  let filtered = allTransactions.filter(tx => {
    let match = true;
    
    // Search by ID, Type, Reference
    if (searchVal) {
      const searchTarget = `${tx.id} ${tx.type} ${tx.reference}`.toLowerCase();
      match = match && searchTarget.includes(searchVal);
    }
    
    // Filter by Exact Type
    if (typeVal) {
      match = match && (tx.type && tx.type.toLowerCase() === typeVal.toLowerCase());
    }

    // Filter by Exact Status
    if (statusVal) {
      match = match && (tx.status && tx.status.toLowerCase() === statusVal.toLowerCase());
    }
    
    // Filter by Exact Date Formatted
    if (dateVal) {
      if(tx.created_at) {
        const txDate = new Date(tx.created_at).toISOString().split('T')[0];
        match = match && (txDate === dateVal);
      } else {
        match = false; // Drop if no date exists
      }
    }
    
    return match;
  });

  renderTransactions(filtered);
}

// Attach Event Listeners to all 4 inputs
document.getElementById("searchInput").addEventListener("input", applyFilters);
document.getElementById("typeFilter").addEventListener("change", applyFilters);
document.getElementById("statusFilter").addEventListener("change", applyFilters);
document.getElementById("dateFilter").addEventListener("change", applyFilters);

// Initial Load
fetchTransactions()
