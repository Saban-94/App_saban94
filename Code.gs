/**
 * @file Code.gs
 * @description The complete and unified server-side logic for the Saban CRM system.
 * This script handles all data interactions for both the Admin Dashboard and the Client App.
 * Includes online status tracking and request status updates.
 * Author: Gemini AI for Rami
 */

// ========== 1. GLOBAL CONFIGURATION ==========
const SPREADSHEET_ID = "19j98mRzvN1ZjKiRtoCYKgRTV9HiF_aXUcUAMhp4Jdm8";
const MAIN_SHEET_NAME = "מעקב";
const REQUESTS_SHEET_NAME = "בקשות";
const FCM_URL = 'https://fcm.googleapis.com/fcm/send';

// Column Names for MAIN_SHEET_NAME
const CLIENT_ID_COLUMN = "מספר לקוח";
const CLIENT_NAME_COLUMN = "שם לקוח";
const CLIENT_PHONE_COLUMN = "טלפון לקוח";

// Column Names for REQUESTS_SHEET_NAME
const REQ_TIMESTAMP_COL = "Timestamp";
const REQ_CLIENT_ID_COL = "מספר לקוח";
const REQ_CLIENT_NAME_COL = "שם לקוח";
const REQ_TYPE_COL = "סוג בקשה";
const REQ_DETAILS_COL = "פרטים";
const REQ_STATUS_COL = "סטטוס טיפול";


// ========== 2. MAIN ROUTERS (GET & POST) ==========

function doGet(e) {
  try {
    const action = e.parameter.action;
    const identifier = e.parameter.id || e.parameter.identifier;
    let responseData;

    if (identifier) {
      responseData = getClientSpecificData(identifier);
    } else {
      switch (action) {
        case "getAllClients": responseData = getAllActiveClients(); break;
        case "getRecentRequests": responseData = getRecentRequests(); break;
        default: responseData = { error: 'Invalid GET action or missing client identifier.' };
      }
    }
    return createJsonResponse(responseData);
  } catch (err) {
    Logger.log('doGet Error: ' + err.message);
    return createJsonResponse({ error: 'An unexpected server error occurred: ' + err.message });
  }
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    let responseData;

    switch (request.action) {
      case 'sendAdminNotification': responseData = sendAdminNotification(request); break;
      case 'getClientData': responseData = getClientSpecificData(request.identifier); break;
      case 'clientRequest': responseData = handleClientRequest(request); break;
      case 'saveClientToken': responseData = saveClientToken(request.clientId, request.token); break;
      case 'markRequestHandled': responseData = markRequestHandled(request); break; 
      case "getAllClients": responseData = getAllActiveClients(); break;
      case "getRecentRequests": responseData = getRecentRequests(); break;
      default: throw new Error("Invalid 'action' parameter provided in POST request.");
    }

    return createJsonResponse({ status: 'success', ...responseData });
  } catch (error) {
    Logger.log(`doPost Error: ${error.message}`);
    return createJsonResponse({ status: 'error', message: error.message });
  }
}

// ========== 3. ADMIN DASHBOARD DATA FUNCTIONS ==========

function getAllActiveClients() {
  const sheet = getSheet(MAIN_SHEET_NAME);
  if (sheet.getLastRow() < 2) return { clients: [] };

  const allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);
  const userProps = PropertiesService.getUserProperties();

  const activeClients = allData
    .map(row => objectifyRow(row, headers))
    .filter(order => order && order["סטטוס"] && String(order["סטטוס"]).toLowerCase() === 'פתוח')
    .map(order => {
      const clientId = order[CLIENT_ID_COLUMN] || null;
      if (!clientId) return null;

      const lastSeen = userProps.getProperty('last_seen_' + clientId);
      const isOnline = lastSeen ? (new Date() - new Date(lastSeen)) < 3 * 60 * 1000 : false; // 3 minutes threshold

      return {
        clientId: clientId,
        clientName: order[CLIENT_NAME_COLUMN] || "שם לא זמין",
        address: order["כתובת"] || "כתובת לא זמינה",
        daysOnSite: calculateDaysPassed(order["תאריך הזמנה"]),
        isOnline: isOnline,
        lastSeen: lastSeen
      };
    })
    .filter(client => client !== null);
  
  const uniqueClients = Array.from(new Map(activeClients.map(client => [client.clientId, client])).values());
  return { clients: uniqueClients };
}

function getRecentRequests() {
  const sheet = getSheet(REQUESTS_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { requests: [] };
  
  const startRow = Math.max(2, lastRow - 19);
  const numRows = lastRow - startRow + 1;
  const allData = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
  const headers = getHeaders(sheet);

  const requests = allData
    .filter(row => row.some(cell => cell !== ""))
    .map(row => objectifyRow(row, headers))
    .map(req => ({
      // FIX: Using constants to read from the object, ensuring it matches the sheet headers.
      timestamp: req[REQ_TIMESTAMP_COL] || new Date(), 
      clientId: req[REQ_CLIENT_ID_COL] || "לא זמין", 
      clientName: req[REQ_CLIENT_NAME_COL] || "שם לא זמין", 
      type: req[REQ_TYPE_COL] || "לא צוין",
      details: req[REQ_DETAILS_COL] || "",
      status: req[REQ_STATUS_COL] || "חדש"
    }))
    .reverse();
    
  return { requests: requests };
}

// ========== 4. CLIENT APP DATA FUNCTIONS ==========

function getClientSpecificData(identifier) {
  Logger.log(`Searching for client with identifier: ${identifier}`);
  const sheet = getSheet(MAIN_SHEET_NAME);
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift() || [];
  
  const clientIdColIdx = headers.indexOf(CLIENT_ID_COLUMN);
  if (clientIdColIdx === -1) throw new Error(`Config error: Column '${CLIENT_ID_COLUMN}' not found.`);
  
  const clientRows = findClientRows(allData, headers, identifier);
  if (clientRows.length === 0) throw new Error(`Client '${identifier}' not found.`);

  const jsonData = clientRows.map(row => objectifyRow(row, headers));
  const clientName = jsonData[0][CLIENT_NAME_COLUMN];
  const clientId = jsonData[0][CLIENT_ID_COLUMN];

  if (clientId) {
    PropertiesService.getUserProperties().setProperty('last_seen_' + clientId, new Date().toISOString());
  }

  return { clientName, clientId, orders: jsonData };
}

// ========== 5. ACTION & NOTIFICATION FUNCTIONS ==========

function handleClientRequest(request) {
  let sheet = getSheet(REQUESTS_SHEET_NAME);
  // FIX: Appending data in the correct order based on new Hebrew headers.
  sheet.appendRow([ new Date(), request.clientId, request.clientName, request.requestType, request.details, "חדש" ]);
  notifyAdminOfNewRequest(request.clientName, request.requestType);
  return { message: "הבקשה נשלחה בהצלחה." };
}

function markRequestHandled(request) {
  const { timestamp, clientId } = request;
  if (!timestamp || !clientId) throw new Error("Missing data for marking request.");

  const sheet = getSheet(REQUESTS_SHEET_NAME);
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift();
  
  const statusColIdx = headers.indexOf(REQ_STATUS_COL);
  const timestampColIdx = headers.indexOf(REQ_TIMESTAMP_COL);
  const clientIdColIdx = headers.indexOf(REQ_CLIENT_ID_COL);

  if (statusColIdx === -1) throw new Error(`Column '${REQ_STATUS_COL}' not found in Requests sheet.`);

  const requestDate = new Date(timestamp);

  for (let i = allData.length - 1; i >= 0; i--) {
    const row = allData[i];
    const rowDate = new Date(row[timestampColIdx]);
    const rowClientId = row[clientIdColIdx];
    if (rowClientId == clientId && Math.abs(rowDate - requestDate) < 1000) {
      sheet.getRange(i + 2, statusColIdx + 1).setValue("טופל");
      return { message: "Request marked as handled." };
    }
  }
  throw new Error("Could not find the specific request to mark as handled.");
}

function sendAdminNotification(requestData) {
  const { clientId, title, body } = requestData;
  const token = PropertiesService.getUserProperties().getProperty('fcm_token_' + clientId);
  if (token) {
    sendPushNotification(token, title, body);
    return { message: 'ההתראה נשלחה בהצלחה.' };
  }
  throw new Error('שליחת ההתראה נכשלה. ייתכן שהלקוח טרם התחבר לאפליקציה או לא אישר קבלת התראות.');
}

function saveClientToken(clientId, token) {
  if (clientId && token) {
    PropertiesService.getUserProperties().setProperty('fcm_token_' + clientId, token);
    return { message: "Token saved." };
  }
  return { message: "No token or client ID provided." };
}

function notifyAdminOfNewRequest(clientName, requestType) {
  const adminToken = PropertiesService.getUserProperties().getProperty('fcm_token_admin'); 
  if (adminToken) {
    const title = "🔔 בקשה חדשה מלקוח";
    const body = `${clientName} שלח בקשת ${requestType} חדשה.`;
    sendPushNotification(adminToken, title, body);
  }
}

function sendPushNotification(token, title, body) {
  const SERVER_KEY = PropertiesService.getScriptProperties().getProperty('FCM_SERVER_KEY');
  if (!SERVER_KEY) {
    Logger.log("ERROR: FCM_SERVER_KEY not set in Script Properties.");
    return;
  }
  const payload = { to: token, notification: { title, body, icon: "https://img.icons8.com/?size=192&id=9fZ3EWahbXyH&format=png&color=000000" }};
  UrlFetchApp.fetch(FCM_URL, {
    method: 'post', contentType: 'application/json',
    headers: { 'Authorization': 'key=' + SERVER_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

// ========== 6. HELPER & UTILITY FUNCTIONS ==========

function getSheet(sheetName) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      if (sheetName === REQUESTS_SHEET_NAME) {
        sheet = ss.insertSheet(REQUESTS_SHEET_NAME);
        // FIX: Creating the sheet with the correct Hebrew headers from the start.
        sheet.appendRow([REQ_TIMESTAMP_COL, REQ_CLIENT_ID_COL, REQ_CLIENT_NAME_COL, REQ_TYPE_COL, REQ_DETAILS_COL, REQ_STATUS_COL]);
      } else {
        throw new Error(`Sheet "${sheetName}" not found.`);
      }
    } else if (sheetName === REQUESTS_SHEET_NAME) {
      const headers = getHeaders(sheet);
      if (headers.indexOf(REQ_STATUS_COL) === -1) {
        sheet.getRange(1, headers.length + 1).setValue(REQ_STATUS_COL);
      }
    }
    return sheet;
}

function findClientRows(data, headers, identifier) {
  const clientIdColIdx = headers.indexOf(CLIENT_ID_COLUMN);
  const clientPhoneColIdx = headers.indexOf(CLIENT_PHONE_COLUMN);
  const cleanId = String(identifier).trim();
  
  let rows = data.filter(row => String(row[clientIdColIdx]).trim() == cleanId);
  if (rows.length > 0) return rows;

  if (clientPhoneColIdx !== -1) {
    const numericId = cleanId.replace(/[^0-9]/g, '');
    if (numericId) {
      rows = data.filter(row => {
        const phone = String(row[clientPhoneColIdx]).replace(/[^0-9]/g, '');
        return phone.endsWith(numericId);
      });
    }
  }
  return rows;
}

function getHeaders(sheet) { return (sheet.getLastRow() > 0) ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim()) : []; }
function objectifyRow(row, headers) { const obj = {}; headers.forEach((h, i) => { obj[h] = row[i]; }); return obj; }
function calculateDaysPassed(startDate) { if (!(startDate instanceof Date)) return 0; const diff = new Date().getTime() - startDate.getTime(); return Math.max(0, Math.floor(diff / 86400000)); }
function createJsonResponse(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

