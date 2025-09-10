/**
 * @file app.js
 * @description Main client-side logic for the Container Management CRM PWA.
 * Handles data fetching, UI updates, event listeners, and notifications.
 */

// --- 1. CONFIGURATION & SETUP ---
// ⭐ FIX: Updated with the new deployment URL from the user.
const API_URL = 'https://script.google.com/macros/s/AKfycbzR-udDz38BylrphOWQpdezpLdFBh9LqjYPtjFO0boK-xhiad1y6McWc8Vy4EthOud6/exec';

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBV_2JwCLtow5F6C7463NmfP2py5W-fj5I",
    authDomain: "hsaban94-cc777.firebaseapp.com",
    projectId: "hsaban94-cc777",
    storageBucket: "hsaban94-cc777.appspot.com",
    messagingSenderId: "299206369469",
    appId: "1:299206369469:web:50ca90c58f1981ec9457d4"
};

// --- 2. STATE MANAGEMENT ---
let currentClient = {
    id: null,
    name: null
};

// --- 3. DOM ELEMENT SELECTORS ---
const dom = {
    loader: document.getElementById('loader'),
    appContent: document.getElementById('app-content'),
    clientName: document.getElementById('client-name'),
    activeOrderSection: document.getElementById('active-order-section'),
    noActiveOrder: document.getElementById('no-active-order'),
    statusBadge: document.getElementById('status-badge'),
    orderAddress: document.getElementById('order-address'),
    orderId: document.getElementById('order-id'),
    daysOnSite: document.getElementById('days-on-site'),
    lastAction: document.getElementById('last-action'),
    historyList: document.getElementById('history-list'),
    requestSwapBtn: document.getElementById('request-swap-btn'),
    requestRemovalBtn: document.getElementById('request-removal-btn'),
    notificationModal: document.getElementById('notification-modal'),
    confirmNotificationsBtn: document.getElementById('confirm-notifications'),
    cancelNotificationsBtn: document.getElementById('cancel-notifications'),
    progressBar: document.getElementById('order-progress-bar'),
    progressStartDate: document.getElementById('progress-start-date'),
    progressEndDate: document.getElementById('progress-end-date'),
    toastContainer: document.getElementById('toast-container'),
};

// --- 4. APPLICATION INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded. Initializing app...');
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('id');

    if (!clientId) {
        showError('שגיאה: לא זוהה מספר לקוח בכתובת ה-URL.');
        return;
    }
    
    currentClient.id = clientId;
    console.log(`Client ID found: ${clientId}`);

    initializeFirebase(clientId);
    loadClientData(clientId);
});

// --- 5. CORE LOGIC ---
async function loadClientData(clientId) {
    showLoader(true, 'טוען נתונים...');
    try {
        const response = await fetch(`${API_URL}?id=${clientId}`);
        if (!response.ok) throw new Error(`שגיאת רשת: ${response.status}`);
        
        const data = await response.json();
        if (data.error) throw new Error(`שגיאה מהשרת: ${data.error}`);
        
        console.log("Parsed data object:", data);
        updateUI(data);

    } catch (error) {
        console.error('CRITICAL ERROR during data loading:', error);
        showError(`אופס, משהו השתבש.<br>${error.message}`);
    } finally {
        showLoader(false);
    }
}

function updateUI(data) {
    try {
        const { clientInfo, activeOrder, orderHistory } = data;

        currentClient.name = clientInfo.name || 'לקוח יקר';
        if(dom.clientName) dom.clientName.textContent = `שלום, ${currentClient.name}`;

        if (activeOrder && activeOrder.orderId) {
            if(dom.activeOrderSection) dom.activeOrderSection.style.display = 'block';
            if(dom.noActiveOrder) dom.noActiveOrder.style.display = 'none';
            if(dom.statusBadge) dom.statusBadge.textContent = activeOrder.status || 'לא ידוע';
            if(dom.statusBadge) dom.statusBadge.className = `status-badge ${getBadgeClass(activeOrder.status)}`;
            if(dom.orderAddress) dom.orderAddress.textContent = activeOrder.address || 'לא צוינה';
            if(dom.orderId) dom.orderId.textContent = activeOrder.orderId || 'N/A';
            if(dom.daysOnSite) dom.daysOnSite.textContent = activeOrder.daysOnSite || '0';
            if(dom.lastAction) dom.lastAction.textContent = activeOrder.lastAction || 'N/A';
            updateProgressBar(activeOrder);
        } else {
            if(dom.activeOrderSection) dom.activeOrderSection.style.display = 'none';
            if(dom.noActiveOrder) dom.noActiveOrder.style.display = 'block';
        }

        if(dom.historyList){
            dom.historyList.innerHTML = '';
            if (orderHistory && orderHistory.length > 0) {
                const historyFragment = document.createDocumentFragment();
                orderHistory.forEach(order => {
                    const item = document.createElement('div');
                    item.className = 'history-item';
                    item.innerHTML = `
                        <div class="icon-wrapper">
                             <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path fill="currentColor" d="M13 2v7h7z"/></svg>
                        </div>
                        <div class="details">
                            <div class="title"><strong>${order.action || 'פעולה'}</strong> - תעודה: ${order.orderId || 'N/A'}</div>
                            <div class="meta">
                                <span>${order.date || 'אין תאריך'}</span><span class="separator">•</span><span>${order.address || 'אין כתובת'}</span>
                            </div>
                        </div>
                        <div class="status-tag-wrapper">
                            <span class="status-tag ${getBadgeClass(order.status)}">${order.status || 'לא ידוע'}</span>
                        </div>
                    `;
                    historyFragment.appendChild(item);
                });
                dom.historyList.appendChild(historyFragment);
            } else {
                dom.historyList.innerHTML = '<div class="empty-state">לא נמצאה היסטוריית הזמנות.</div>';
            }
        }
    } catch (error) {
        console.error("A critical error occurred within the main updateUI function:", error);
        showError('שגיאה קריטית בעדכון הממשק.');
    }
}


// --- 6. EVENT LISTENERS & ACTIONS ---
if(dom.requestSwapBtn) dom.requestSwapBtn.addEventListener('click', () => handleAction('swap'));
if(dom.requestRemovalBtn) dom.requestRemovalBtn.addEventListener('click', () => handleAction('removal'));
if(dom.confirmNotificationsBtn) dom.confirmNotificationsBtn.addEventListener('click', requestNotificationPermission);
if(dom.cancelNotificationsBtn) dom.cancelNotificationsBtn.addEventListener('click', () => {
    if (dom.notificationModal) dom.notificationModal.style.display = 'none';
});

async function handleAction(actionType) {
    const actionText = actionType === 'swap' ? 'החלפה' : 'פינוי';
    
    const btn = actionType === 'swap' ? dom.requestSwapBtn : dom.requestRemovalBtn;
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'logClientRequest',
                clientId: currentClient.id,
                clientName: currentClient.name,
                requestType: actionType
            })
        });
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
        
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        btn.classList.remove('loading');
        btn.classList.add('success');
        btn.innerHTML = `
            <svg class="icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>
            הבקשה נשלחה
        `;
        showToast('הבקשה נשלחה בהצלחה!', 'success');

    } catch (error) {
        console.error('Failed to send action request:', error);
        showToast(`אופס, שליחת הבקשה נכשלה. (${error.message})`, 'error');
        btn.classList.remove('loading');
        btn.disabled = false;
        // Restore original button text and icons
        if (actionType === 'swap') {
            btn.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="m17.65 6.35l-1.42 1.42A6.995 6.995 0 0 0 12 4c-3.87 0-7 3.13-7 7s3.13 7 7 7c2.21 0 4.21-.99 5.5-2.64l1.5 1.5A8.96 8.96 0 0 1 12 20a9 9 0 0 1-9-9a9 9 0 0 1 9-9c2.65 0 5.05 1.14 6.78 2.97l1.44-1.44z"/></svg> בקש החלפה`;
        } else {
            btn.innerHTML = `<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M11 20V8.25q0-.525.338-1.125t.912-.875L16.5 3H6.75q-.95 0-1.687.738T4.325 5.5v13q0 .95.738 1.688T6.75 21H11v-1zm1 1h5.25q.95 0 1.688-.737T19.675 18.5v-13q0-.95-.737-1.688T17.25 3H12v18z"/></svg> בקש פינוי`;
        }
    } 
}

// --- 7. HELPER & UI FUNCTIONS ---
function updateProgressBar(order) {
    if (!dom.progressBar || !dom.progressStartDate || !dom.progressEndDate || !order.startDate || !order.endDate) return;
    try {
        const start = new Date(order.startDate.split('/').reverse().join('-'));
        const end = new Date(order.endDate.split('/').reverse().join('-'));
        const today = new Date();
        
        if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
            dom.progressBar.style.width = '0%';
            return;
        }
        const totalDuration = (end - start) / (1000 * 60 * 60 * 24);
        const elapsedDuration = (today - start) / (1000 * 60 * 60 * 24);
        let percentage = totalDuration > 0 ? (elapsedDuration / totalDuration) * 100 : 0;
        percentage = Math.max(0, Math.min(percentage, 100));
        dom.progressBar.style.width = percentage + '%';
        if (percentage > 80) { dom.progressBar.className = 'progress-bar danger'; } 
        else if (percentage > 50) { dom.progressBar.className = 'progress-bar warning'; } 
        else { dom.progressBar.className = 'progress-bar success'; }
        dom.progressStartDate.textContent = order.startDate;
        dom.progressEndDate.textContent = order.endDate;
    } catch(e) {
        console.error("Could not parse dates for progress bar:", order.startDate, order.endDate);
    }
}

function showLoader(visible, text = '') {
    if (dom.loader) {
        dom.loader.style.display = visible ? 'flex' : 'none';
        if (visible) dom.loader.querySelector('p').textContent = text;
    }
    if (dom.appContent) {
        dom.appContent.style.visibility = visible ? 'hidden' : 'visible';
        if (!visible) dom.appContent.classList.add('fade-in');
    }
}

function showError(message) {
    if (dom.loader) {
        dom.loader.innerHTML = `<div class="error-state">${message}</div>`;
        dom.loader.style.display = 'flex';
    }
    if (dom.appContent) {
        dom.appContent.style.display = 'none';
    }
}

function getBadgeClass(status = "") {
    const s = String(status || "").toLowerCase();
    if (s.includes('פתוח')) return 'open';
    if (s.includes('סגור')) return 'closed';
    return 'default';
}

function showToast(message, type = 'info') {
    if (!dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}


// --- 8. PUSH NOTIFICATIONS LOGIC ---
function initializeFirebase(clientId) {
    try {
        if (typeof firebase !== 'undefined' && !firebase.apps.length) {
            firebase.initializeApp(FIREBASE_CONFIG);
            const messaging = firebase.messaging();
            setupNotifications(messaging, clientId);
        } else {
             console.warn("Firebase SDK not found or already initialized.");
        }
    } catch (error) {
        console.error("Firebase initialization failed:", error);
    }
}

function setupNotifications(messaging, clientId) {
    if (Notification.permission === 'granted') {
        retrieveToken(messaging, clientId);
        return;
    }
    if (Notification.permission === 'denied') { return; }
    
    setTimeout(() => {
        if (dom.notificationModal) dom.notificationModal.style.display = 'flex';
    }, 3000);
}

async function requestNotificationPermission() {
    if (dom.notificationModal) dom.notificationModal.style.display = 'none';
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showToast('אישרת קבלת עדכונים!', 'success');
            const clientId = new URLSearchParams(window.location.search).get('id');
            initializeFirebase(clientId);
        } else {
            showToast('תוכל להפעיל עדכונים בהגדרות הדפדפן.', 'info');
        }
    } catch (error) {
        console.error('Error requesting notification permission', error);
    }
}

async function retrieveToken(messaging, clientId) {
    try {
        const vapidKey = 'YOUR_VAPID_PUBLIC_KEY'; // Replace with your key
        const currentToken = await messaging.getToken({ vapidKey: vapidKey });

        if (currentToken) {
            console.log('FCM Token:', currentToken);
            sendTokenToServer(clientId, currentToken);
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
    }
}

async function sendTokenToServer(clientId, token) {
    console.log(`Sending token to server for client ${clientId}...`);
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveFCMToken',
                clientId: clientId,
                token: token
            })
        });
        if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        console.log('Token successfully saved on the server.');
    } catch (error) {
        console.error('Failed to send token to server:', error);
    }
}
