/**
 * @file admin.app.js
 * @description Client-side logic for the Admin Dashboard.
 * This version includes robust event handling for dynamic elements.
 */

// ⭐ ACTION REQUIRED: Replace with the new URL from your latest deployment.
const API_URL = 'https://script.google.com/macros/s/AKfycbwfRTTD1IyvbJPNuIzsip4kN-QX--hkRbGv7cHgZckODkZfOzPXaJQegwDMXvSethv0/exec'; 

// --- DOM Elements ---
const clientsTableBody = document.getElementById('clients-table-body');
const requestsLog = document.getElementById('requests-log');
const clientsLoader = document.getElementById('clients-loader');
const requestsLoader = document.getElementById('requests-loader');
const modal = document.getElementById('notification-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const notificationForm = document.getElementById('notification-form');
const modalClientId = document.getElementById('modal-client-id');
const modalClientName = document.getElementById('modal-client-name');
const templateSelect = document.getElementById('notification-template');
const notificationTitleInput = document.getElementById('notification-title');
const notificationBodyInput = document.getElementById('notification-body');

// --- Notification Templates ---
const notificationTemplates = [
    { title: "בחר תבנית...", subject: "", text: "" },
    { title: "עדכון לגבי הזמנה", subject: "עדכון לגבי הזמנתך", text: "שלום {{clientName}}, יש לנו עדכון בנוגע להזמנתך." },
    { title: "נהג בדרך", subject: "הנהג בדרך אליך!", text: "שלום {{clientName}}, הנהג בדרך אליך עם המכולה. צפי הגעה בקרוב." },
    { title: "תזכורת לפינוי", subject: "תזכורת לפינוי מכולה", text: "שלום {{clientName}}, תזכורת קטנה שהמכולה צפויה להתפנות בקרוב. נשמח לעדכון." }
];

// --- API Functions ---
async function fetchData(action) {
    try {
        const response = await fetch(`${API_URL}?action=${action}`);
        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(`API error: ${data.error}`);
        return data;
    } catch (error) {
        console.error(`Failed to fetch ${action}:`, error);
        alert(`שגיאה בטעינת הנתונים: ${error.message}`);
        return null;
    }
}

async function postData(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, ...payload })
        });
        if (!response.ok) throw new Error(`Network error: ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);
        return result;
    } catch (error) {
        console.error(`Failed to post ${action}:`, error);
        alert(`שליחת הנתונים נכשלה: ${error.message}`);
        return null;
    }
}

// --- UI Update Functions ---
async function loadActiveClients() {
    const data = await fetchData('getAllClients');
    if (clientsLoader) clientsLoader.style.display = 'none';

    if (!data || !data.clients || data.clients.length === 0) {
        clientsTableBody.innerHTML = '<tr><td colspan="5" class="placeholder-row">לא נמצאו לקוחות פעילים.</td></tr>';
        return;
    }

    clientsTableBody.innerHTML = '';
    data.clients.forEach(client => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.clientId}</td>
            <td>${client.clientName}</td>
            <td>${client.address}</td>
            <td>${client.daysOnSite}</td>
            <td>
                <button class="btn primary" data-id="${client.clientId}" data-name="${client.clientName}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M22 12a10 10 0 0 1-10 10c-2.3 0-4.41-.76-6.15-2.06a.75.75 0 0 1 .62-1.32c1.45.34 3 .58 4.65.58a8.5 8.5 0 1 0-5.4-8.08a.75.75 0 0 1-1.3-.62A10 10 0 0 1 22 12Z"/></svg>
                    שלח התראה
                </button>
            </td>
        `;
        clientsTableBody.appendChild(row);
    });
}

async function loadRecentRequests() {
    const data = await fetchData('getRecentRequests');
    if(requestsLoader) requestsLoader.style.display = 'none';
    if (!data || !data.requests || data.requests.length === 0) {
        requestsLog.innerHTML = '<li class="placeholder-row">אין בקשות חדשות.</li>';
        return;
    }

    requestsLog.innerHTML = '';
    data.requests.forEach(req => {
        const item = document.createElement('li');
        const icon = req.type === 'החלפה' ? 
            `<div class="icon swap"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="m17.65 6.35l-1.42 1.42A6.995 6.995 0 0 0 12 4c-3.87 0-7 3.13-7 7s3.13 7 7 7c2.21 0 4.21-.99 5.5-2.64l1.5 1.5A8.96 8.96 0 0 1 12 20a9 9 0 0 1-9-9a9 9 0 0 1 9-9c2.65 0 5.05 1.14 6.78 2.97l1.44-1.44z"/></svg></div>` :
            `<div class="icon removal"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M11 20V8.25q0-.525.338-1.125t.912-.875L16.5 3H6.75q-.95 0-1.687.738T4.325 5.5v13q0 .95.738 1.688T6.75 21H11v-1zm1 1h5.25q.95 0 1.688-.737T19.675 18.5v-13q0-.95-.737-1.688T17.25 3H12v18z"/></svg></div>`;
        
        item.innerHTML = `
            ${icon}
            <div class="content">
                <strong>בקשת ${req.type}</strong>
                <div class="meta">${req.clientName} • ${new Date(req.timestamp).toLocaleString('he-IL')}</div>
            </div>
        `;
        requestsLog.appendChild(item);
    });
}

// --- Modal Logic ---
function openNotificationModal(clientId, clientName) {
    modalClientId.value = clientId;
    modalClientName.textContent = clientName;
    
    templateSelect.innerHTML = '';
    notificationTemplates.forEach((t, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = t.title;
        templateSelect.appendChild(option);
    });

    notificationForm.reset();
    modal.classList.add('show');
}

function fillTemplate() {
    const selectedIndex = templateSelect.value;
    const template = notificationTemplates[selectedIndex];
    if (!template || selectedIndex == 0) return;

    const clientName = modalClientName.textContent;
    let body = template.text.replace('{{clientName}}', clientName);
    
    notificationTitleInput.value = template.subject;
    notificationBodyInput.value = body;
}

async function handleSendNotification(event) {
    event.preventDefault();
    const clientId = modalClientId.value;
    const title = notificationTitleInput.value;
    const body = notificationBodyInput.value;
    
    const submitBtn = notificationForm.querySelector('button[type="submit"]');
    submitBtn.textContent = 'שולח...';
    submitBtn.disabled = true;

    const result = await postData('sendAdminNotification', { clientId, title, body });
    
    if (result) {
        alert('ההתראה נשלחה בהצלחה!');
        modal.classList.remove('show');
        notificationForm.reset();
    }

    submitBtn.textContent = 'שלח עכשיו';
    submitBtn.disabled = false;
}

// --- Event Listeners ---

/**
 * Initializes all event listeners for the application.
 */
function initializeEventListeners() {
    // Load initial data when the page is ready
    loadActiveClients();
    loadRecentRequests();
    // Set an interval to refresh the requests log periodically
    setInterval(loadRecentRequests, 20000); 

    // ⭐ FIX: This is the core of the solution.
    // We add ONE event listener to the table body that exists on page load.
    // This listener will catch clicks that "bubble up" from the buttons,
    // even if the buttons are added dynamically later.
    clientsTableBody.addEventListener('click', (event) => {
        // Find the button that was clicked inside the table row.
        // event.target is the specific element clicked (e.g., the SVG or the text).
        // .closest('button') finds the nearest parent that is a button.
        const button = event.target.closest('button');

        // Check if a button was actually clicked and if it has the necessary data.
        if (button && button.dataset.id) {
            console.log(`Button clicked for client ID: ${button.dataset.id}`);
            const { id, name } = button.dataset;
            // This is the function responsible for opening the modal.
            openNotificationModal(id, name);
        }
    });

    // Listeners for the modal
    modalCloseBtn.addEventListener('click', () => modal.classList.remove('show'));
    notificationForm.addEventListener('submit', handleSendNotification);
    templateSelect.addEventListener('change', fillTemplate);
}

// --- App Start ---
document.addEventListener('DOMContentLoaded', initializeEventListeners);

