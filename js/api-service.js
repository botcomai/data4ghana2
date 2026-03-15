// ==========================================
// DATA4GHANA API SERVICE MODULE
// Reusable functions to interact with the
// Data4Ghana VTU API via Supabase Edge Functions
// ==========================================

const SUPABASE_FUNCTIONS_URL = "https://wynmejzsybkxhqvazjzu.supabase.co/functions/v1";

/**
 * Place a data order via the Data4Ghana API
 * @param {string} network - Network name (MTN, Telecel, AirtelTigo)
 * @param {string} phone - Recipient phone number
 * @param {string} dataSize - Data size (e.g., "1GB", "2GB", "5GB")
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function placeDataOrder(network, phone, dataSize) {
  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/place-data-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        network: network,
        phone: phone,
        data_size: dataSize,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Order placement failed',
        api_response: result.data || result.api_response || null,
      };
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    console.error('API Service Error (placeDataOrder):', error);
    return {
      success: false,
      error: 'Network error: Unable to reach the API. Please try again.',
    };
  }
}

/**
 * Check the status of a data order via the Data4Ghana API
 * @param {string} phone - Phone number (optional if reference provided)
 * @param {string} reference - Order reference ID (optional if phone provided)
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function checkOrderStatus(phone, reference) {
  try {
    const body = {};
    if (phone) body.phone = phone;
    if (reference) body.reference = reference;

    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/check-order-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || 'Status check failed',
        api_response: result.data || result.api_response || null,
      };
    }

    return {
      success: true,
      data: result.data,
    };

  } catch (error) {
    console.error('API Service Error (checkOrderStatus):', error);
    return {
      success: false,
      error: 'Network error: Unable to reach the API. Please try again.',
    };
  }
}

// Export to window for global access
window.placeDataOrder = placeDataOrder;
window.checkOrderStatus = checkOrderStatus;
