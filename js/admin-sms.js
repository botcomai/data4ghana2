let userPhoneNumbers = [];

// 1. Authenticate and Load Contacts
async function loadAdminData() {
    // Basic auth check (You should ideally verify user is an "admin" role in a real prod environment)
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) {
        window.location.href = "login.html";
        return;
    }

    try {
        // Fetch all registered users' phone numbers
        const { data, error } = await supabase
            .from('users')
            .select('phone')
            .not('phone', 'is', null);

        if(error) throw error;

        // Strip duplicates and blanks
        const rawNumbers = data.map(u => u.phone).filter(p => p && p.trim() !== "");
        userPhoneNumbers = [...new Set(rawNumbers)];

        document.getElementById('userCount').innerText = userPhoneNumbers.length;
        
    } catch (err) {
        console.error("Failed to load users:", err);
        alert("Error loading contact list from database.");
    }
}

// 2. Fetch SMS Balance from our Secure Edge Function
async function checkSmsBalance() {
    const balanceElem = document.getElementById('smsBalance');
    balanceElem.innerText = "...";

    try {
        const { data, error } = await supabase.functions.invoke('check-sms-balance');
        if (error) throw error;
        
        let responseString = data.balance_response || "";
        
        // BulkSMSGh typically returns balance as "1000|Success"
        if(responseString.includes("|")) {
            balanceElem.innerText = responseString.split("|")[0];
        } else {
            balanceElem.innerText = responseString;
        }

    } catch (err) {
        console.error("Balance Check Error:", err);
        balanceElem.innerText = "Error";
    }
}

// 3. Track character count as the admin types
document.getElementById('broadcastMessage').addEventListener('input', function() {
    document.getElementById('charCount').innerText = this.value.length;
});

// 4. Main Dispatch Loop
async function confirmBroadcast() {
    const text = document.getElementById('broadcastMessage').value.trim();
    
    if(text === "") {
        alert("Please enter a message to broadcast.");
        return;
    }

    if(userPhoneNumbers.length === 0) {
        alert("No valid phone numbers found in the database to text.");
        return;
    }

    // Double Confirmation dialog
    const confirmed = confirm(`WARNING: You are about to text ${userPhoneNumbers.length} people.\n\nMessage: "${text}"\n\nAre you absolutely sure you want to broadcast this?`);
    
    if(!confirmed) return;

    const btn = document.getElementById('sendBtn');
    btn.disabled = true;
    btn.innerText = "Dispatching Broadcast... Please Wait";

    let successCount = 0;
    let failCount = 0;

    // We dispatch sequentially (or in small batches) to avoid rate-limiting the Edge Function
    for (const phone of userPhoneNumbers) {
        try {
            const { error } = await supabase.functions.invoke('send-sms', {
                body: { to: phone, msg: text }
            });
            if (error) throw error;
            successCount++;
        } catch (err) {
            console.error(`Failed to send SMS to ${phone}:`, err);
            failCount++;
        }
    }

    btn.disabled = false;
    btn.innerHTML = "🚀 Dispatch to All Users";
    document.getElementById('broadcastMessage').value = "";
    document.getElementById('charCount').innerText = "0";

    if(window.showSuccessPopup) {
        window.showSuccessPopup("Broadcast Complete!", `Successfully sent to ${successCount} users. ${failCount} failed.`);
    } else {
        alert(`Broadcast Complete!\nSuccess: ${successCount}\nFailed: ${failCount}`);
    }

    // Refresh balance after sending
    checkSmsBalance();
}

// Initialize scripts
window.addEventListener('DOMContentLoaded', () => {
    loadAdminData();
    checkSmsBalance();
});
