/**
 * Main GET request router.
 * Handles fetching data for the client PWA and the admin dashboard.
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const clientId = e.parameter.id;
    let responseData;

    if (clientId) {
      responseData = getClientDataObject(clientId);
    } else {
      switch (action) {
        case "getAllClients":
          responseData = getAllActiveClients();
          break;
        case "getRecentRequests":
          responseData = getRecentRequests();
          break;
        default:
          responseData = { error: 'No valid action or client ID provided.' };
      }
    }
    // ⭐ FIX: Add CORS headers to all responses to prevent connection issues.
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON)
      .withHeaders({ 'Access-Control-Allow-Origin': '*' });

  } catch (err) {
    Logger.log(err);
    const errorResponse = { error: 'An unexpected server error occurred: ' + err.message };
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON)
      .withHeaders({ 'Access-Control-Allow-Origin': '*' });
  }
}

/**
 * Main POST request router.
 * Handles actions that modify or send data.
 */
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    let responseData;

    switch (action) {
      case 'saveFCMToken':
        responseData = saveToken(requestData.clientId, requestData.token);
        break;
      case 'logClientRequest':
        responseData = handleClientRequest(requestData);
        break;
      case 'sendAdminNotification':
        responseData = sendAdminNotification(requestData);
        break;
      default:
        responseData = { status: 'error', message: 'Invalid POST action.' };
    }
     // ⭐ FIX: Add CORS headers to all POST responses.
    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON)
      .withHeaders({ 'Access-Control-Allow-Origin': '*' });
  } catch (err) {
    Logger.log('Error in doPost: ' + err.message);
    const errorResponse = { status: 'error', message: 'Failed to process POST request.' };
     return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON)
      .withHeaders({ 'Access-Control-Allow-Origin': '*' });
  }
}

// --- NEW ADMIN DASHBOARD FUNCTIONS ---

function getAllActiveClients() {
  const sheet = getSheet("מעקב");
  const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);

  const activeClients = allData
    .map(row => objectifyRow(row, headers))
    .filter(order => String(order["סטטוס"]).toLowerCase() === 'פתוח')
    .map(order => ({
      clientId: order["מספר לקוח"],
      clientName: order["שם לקוח"],
      address: order["כתובת"],
      daysOnSite: calculateDaysPassed(order["תאריך הזמנה"])
    }));
  
  return { clients: activeClients };
}

function getRecentRequests() {
  const sheet = getSheet("בקשות");
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { requests: [] };
  const startRow = Math.max(2, lastRow - 14);
  const numRows = lastRow - startRow + 1;
  const allData = sheet.getRange(startRow, 1, numRows, 4).getValues();
  const requests = allData.map(row => ({
    timestamp: row[0], clientId: row[1], clientName: row[2], type: row[3]
  })).reverse();
  return { requests: requests };
}

function sendAdminNotification(requestData) {
  const { clientId, title, body } = requestData;
  if (!clientId || !title || !body) {
    return { status: 'error', message: 'Missing parameters for notification.' };
  }
  
  // ⭐ FIX: Correctly construct the property key to find the token.
  // The old code `('fcm_token_' in clientId)` was incorrect.
  const tokenKey = 'fcm_token_' + clientId;
  const token = PropertiesService.getUserProperties().getProperty(tokenKey);

  if (token) {
    const appUrl = `https://rami1125.github.io/Crm-App/index.html?id=${clientId}`;
    sendPushNotification(token, title, body, { url: appUrl });
    return { status: 'success', message: 'Notification sent.' };
  } else {
    Logger.log(`Could not find a token for client ${clientId} with key ${tokenKey}.`);
    return { status: 'error', message: 'Could not find token for this client.' };
  }
}


// --- EXISTING CORE & HELPER FUNCTIONS ---
// (All other functions remain the same)

function getSheet(sheetName) {
    const SPREADSHEET_ID = "18Ar32BGjg-zmqNT6EiW1d-GXWy4_4UaEZLpDIF06tt0";
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet named "${sheetName}" not found.`);
    return sheet;
}
function getHeaders(sheet) {
    return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => h.trim());
}
function objectifyRow(row, headers) {
    const obj = {};
    headers.forEach((header, index) => { obj[header] = row[index]; });
    return obj;
}
function getClientDataObject(clientId) {
  const sheet = getSheet("מעקב");
  const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);
  const headerMap = {};
  headers.forEach((header, index) => { headerMap[header] = index; });
  const clientOrdersData = allData.filter(row => String(row[headerMap["מספר לקוח"]]) === String(clientId));
  if (clientOrdersData.length === 0) {
    return { clientInfo: { id: clientId, name: "לקוח לא נמצא" }, activeOrder: null, orderHistory: [] };
  }
  let clientName = "", activeOrder = null, orderHistory = [];
  clientOrdersData.forEach(row => {
    const orderObject = objectifyRow(row, headers);
    if (!clientName) clientName = orderObject["שם לקוח"] || "";
    if (String(orderObject["סטטוס"]).toLowerCase() === 'פתוח') {
      activeOrder = {
        orderId: orderObject["תעודה"], address: orderObject["כתובת"],
        status: orderObject["סטטוס"], endDate: formatDate(orderObject["תאריך סיום צפוי"]),
        startDate: formatDate(orderObject["תאריך הזמנה"]), lastAction: orderObject["סוג פעולה"],
        daysOnSite: calculateDaysPassed(orderObject["תאריך הזמנה"]),
        driverStatus: orderObject["סטטוס נהג"], eta: orderObject["זמן הגעה משוער"]
      };
    }
    orderHistory.push({
      orderId: orderObject["תעודה"], address: orderObject["כתובת"], status: orderObject["סטטוס"],
      action: orderObject["סוג פעולה"], date: formatDate(orderObject["תאריך הזמנה"])
    });
  });
  return { clientInfo: { id: clientId, name: clientName }, activeOrder: activeOrder, orderHistory: orderHistory.sort((a, b) => new Date(b.date) - new Date(a.date)) };
}
function handleClientRequest(requestData) {
  const { clientId, clientName, requestType } = requestData;
  const sheet = getSheet("בקשות");
  const requestDate = new Date();
  const requestTypeText = requestType === 'swap' ? 'החלפה' : 'פינוי';
  sheet.appendRow([requestDate, clientId, clientName, requestTypeText, 'חדש']);
  return { status: 'success', message: 'Request logged successfully.' };
}
function saveToken(clientId, token) {
  PropertiesService.getUserProperties().setProperty('fcm_token_' + clientId, token);
  return { status: 'success', message: `Token for client ${clientId} saved.` };
}
function sendPushNotification(fcmToken, title, body, dataPayload = {}) {
  const SERVER_KEY = "YOUR_FIREBASE_SERVER_KEY_HERE";
  const url = "https://fcm.googleapis.com/fcm/send";
  const payload = { to: fcmToken, notification: { title: title, body: body, icon: "https://placehold.co/192x192/0b72b9/FFFFFF?text=סבן" }, data: dataPayload };
  const options = { method: "post", contentType: "application/json", headers: { Authorization: "key=" + SERVER_KEY }, payload: JSON.stringify(payload) };
  try { UrlFetchApp.fetch(url, options); } catch (e) { Logger.log("Error sending FCM message: " + e.message); }
}

function formatDate(date) {
    if (!date || !(date instanceof Date)) return "";
    let day = date.getDate().toString().padStart(2, '0');
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let year = date.getFullYear();
    return `${day}/${month}/${year}`;
}
function calculateDaysPassed(startDate) {
    if (!startDate || !(startDate instanceof Date)) return 0;
    const today = new Date();
    const differenceInTime = today.getTime() - startDate.getTime();
    return Math.floor(differenceInTime / (1000 * 3600 * 24));
}

