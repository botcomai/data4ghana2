function togglePassword(){
let password = document.getElementById("password");

if(password.type === "password"){
password.type = "text";
}else{
password.type = "password";
}
}

function toggleConfirm(){
let confirmPassword = document.getElementById("confirmPassword");

if(confirmPassword.type === "password"){
confirmPassword.type = "text";
}else{
confirmPassword.type = "password";
}
}

document.getElementById("signupForm").addEventListener("submit", async function(e){
  e.preventDefault();
  
  let pass = document.getElementById("password").value;
  let confirm = document.getElementById("confirmPassword").value;
  
  if(pass !== confirm){
    alert("Passwords do not match");
    return;
  }
  
  let email = document.getElementById("email").value;
  let firstName = document.getElementById("firstName").value;
  let lastName = document.getElementById("lastName").value;
  let phone = document.getElementById("phone").value.trim();
  
  const submitButton = this.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.innerText = "Checking...";
  
  try {
    // ==========================================
    // CHECK IF PHONE NUMBER ALREADY EXISTS
    // ==========================================
    const { data: existingUser, error: phoneCheckError } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (phoneCheckError) {
      console.error("Phone check error:", phoneCheckError);
    }

    if (existingUser) {
      alert("This phone number is already registered. Please use a different phone number or sign in to your existing account.");
      submitButton.disabled = false;
      submitButton.innerText = "Create Account";
      return;
    }

    submitButton.innerText = "Creating Account...";

    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: pass,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          phone: phone
        }
      }
    });
    
    if (error) throw error;
    
    // Dispatch Welcome SMS
    if(window.sendSmsNotification) {
      window.sendSmsNotification(phone, "Welcome to Data4Ghana! Your account has been successfully created. Enjoy fast, secure data and airtime purchases.");
    }
    
    alert("Account created successfully! Please log in.");
    window.location.href = "login.html";
    
  } catch(error) {
    alert("Signup failed: " + error.message);
    submitButton.disabled = false;
    submitButton.innerText = "Create Account";
  }
});
