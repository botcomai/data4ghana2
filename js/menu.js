function openMenu() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) sidebar.classList.add("active");
  if (overlay) overlay.classList.add("active");
}

function closeMenu() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
}

async function logout() {
  if (window.supabase) {
    await window.supabase.auth.signOut();
    window.location.href = "login.html";
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Inject Menu HTML if the container exists
  const menuContainer = document.getElementById("menu-container");
  
  if (menuContainer) {
    try {
      const response = await fetch("components/menu.html");
      const html = await response.text();
      menuContainer.innerHTML = html;

      // 1. Highlight Active Link
      const currentPage = window.location.pathname.split("/").pop() || "dashboard.html";
      const navLinks = document.querySelectorAll("#navMenu a");
      
      navLinks.forEach(link => {
        const linkPage = link.getAttribute("href");
        if (linkPage === currentPage) {
          link.parentElement.classList.add("active");
        }
      });

    } catch (err) {
      console.error("Failed to load menu component", err);
    }
  }

  // Fetch Full User Data for Menu if Supabase is available
  if (window.supabase) {
    const { data: { user }, error: authErr } = await window.supabase.auth.getUser();
    
    if (user && !authErr) {
      
      // Ping database for the custom fields
      const { data, error } = await window.supabase
        .from('users')
        .select('first_name, last_name, avatar_url, merchant_id, role')
        .eq('id', user.id)
        .single();
        
      setTimeout(() => {
        // Name Logic
        let firstName = data?.first_name || "User";
        let lastName = data?.last_name || "";
        const sidebarNameElem = document.getElementById("sidebarName");
        if (sidebarNameElem) sidebarNameElem.innerText = "Data4Ghana";

        // Email
        const sidebarEmailElem = document.getElementById("sidebarEmail");
        if(sidebarEmailElem) sidebarEmailElem.innerText = user.email;

        // ==========================================
        // ROLE BADGE LOGIC
        // ==========================================
        const roleConfig = {
          'admin':        { label: 'ADMIN',        bg: 'rgba(239,68,68,0.15)',  color: '#ef4444', prefix: 'ADMIN-CODE: ' },
          'super_agent':  { label: 'SUPER AGENT',  bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6', prefix: 'AGENT-CODE: ' },
          'elite_agent':  { label: 'ELITE AGENT',  bg: 'rgba(59,130,246,0.15)', color: '#3b82f6', prefix: 'AGENT-CODE: ' },
          'vip_customer': { label: 'VIP CUSTOMER', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', prefix: 'VIP-CODE: ' },
          'client':       { label: 'CLIENT',       bg: '#e2e8f0',               color: '#64748b', prefix: 'CLIENT CODE: ' },
        };

        const userRole = data?.role || 'client';
        const roleStyle = roleConfig[userRole] || roleConfig['client'];

        const sidebarRoleElem = document.getElementById("sidebarRole");
        if (sidebarRoleElem) {
          sidebarRoleElem.innerText = roleStyle.label;
          sidebarRoleElem.style.background = roleStyle.bg;
          sidebarRoleElem.style.color = roleStyle.color;
        }

        // Merchant ID / Client Code Logic
        const sidebarMerchantElem = document.getElementById("sidebarMerchant");
        if(sidebarMerchantElem && data?.merchant_id) {
          sidebarMerchantElem.innerText = (roleStyle.prefix || 'CLIENT CODE: ') + data.merchant_id.substring(0,8).toUpperCase();
        }

        // Store role globally for other pages
        window.currentUserRole = userRole;

        // Show admin menu only for admin and super_agent
        const adminSection = document.getElementById("adminMenuSection");
        if (adminSection) {
          if (userRole === 'admin' || userRole === 'super_agent') {
            adminSection.style.display = 'block';
          } else {
            adminSection.style.display = 'none';
          }
        }

        // Avatar Logic
        let initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || 'D4';
        const avatarElem = document.querySelector(".avatar");
        
        if (avatarElem) {
            if(data?.avatar_url) {
                avatarElem.innerHTML = `<img src="${data.avatar_url}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                avatarElem.style.background = 'transparent';
                avatarElem.style.color = 'transparent';
            } else {
                avatarElem.innerText = initials;
            }
        }
      }, 100);
    }
  }
});

// GLOBAL SUCCESS MODAL INJECTOR
window.showSuccessPopup = function(title, message, callback) {
  let overlay = document.getElementById("globalSuccessOverlay");
  
  // Create it on the fly if it doesn't exist
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "globalSuccessOverlay";
    overlay.className = "success-overlay";
    overlay.innerHTML = `
      <div class="success-modal">
        <div class="success-icon">✓</div>
        <h3 id="successTitle">Success!</h3>
        <p id="successMessage">Action completed successfully.</p>
        <button class="success-btn" id="successBtn">Continue</button>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  
  // Set Text
  document.getElementById("successTitle").innerText = title;
  document.getElementById("successMessage").innerText = message;
  
  // Refresh Button Listeners
  const btn = document.getElementById("successBtn");
  const newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  
  newBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
    if (callback) callback();
  });
  
  // Activate CSS animations
  setTimeout(() => overlay.classList.add("active"), 10);
};

// GLOBAL SMS DISPATCHER (EDGE FUNCTION CALL)
window.sendSmsNotification = async function(phone, message) {
  try {
    if (!window.supabase) return;
    
    // Call our secure backend Edge Function securely
    const { data, error } = await window.supabase.functions.invoke('send-sms', {
      body: { to: phone, msg: message }
    });
    
    if (error) throw error;
    console.log("SMS Dispatch Triggered:", data);
  } catch (err) {
    console.error("SMS Dispatch Failed:", err.message);
  }
};
