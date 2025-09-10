/**
 * @file client.app.js
 * @description All client-side logic for the Saban CRM Client Portal Application.
 * This file manages state, API communication, and dynamic rendering of the mobile app interface.
 * Author: Gemini AI for Rami
 */

document.addEventListener('DOMContentLoaded', () => {
    // ========== STATE & CONFIG ==========
    const API_URL = "https://script.google.com/macros/s/AKfycbwfRTTD1IyvbJPNuIzsip4kN-QX--hkRbGv7cHgZckODkZfOzPXaJQegwDMXvSethv0/exec";
    
    const CHAT_TEMPLATES = [
        "המכולה מלאה, אשמח לתאם פינוי.",
        "צריך להחליף את המכולה במכולה ריקה.",
        "האם ניתן לקבל מכולה נוספת?",
        "מה צפי ההגעה של הנהג?",
        "תודה רבה על השירות המהיר!",
        "יש לי שאלה בנוגע לחיוב.",
        "האם ניתן להאריך את זמן השהייה של המכולה?",
        "עדכון כתובת - הפינוי יתבצע מכתובת אחרת.",
        "בקשה דחופה למכולה, אנא צרו קשר.",
        "הכל בסדר, רק רציתי לוודא שההזמנה התקבלה.",
    ];

    let clientState = {
        id: null,
        name: null,
        orders: [],
        addresses: new Set(),
        historyChart: null,
    };
    let refreshInterval;

    // ========== DOM ELEMENTS ==========
    const appContainer = document.querySelector('.app-container');
    const pages = document.querySelectorAll('.page');
    
    // Header
    const clientNameHeader = document.getElementById('client-name-header');
    const clockDiv = document.getElementById('clock');
    const dateDiv = document.getElementById('date');
    const greetingDiv = document.getElementById('greeting');

    // Home Page
    const activeOrdersContainer = document.getElementById('active-orders-container');
    const noActiveOrdersDiv = document.getElementById('no-active-orders');
    const etaCardContainer = document.getElementById('eta-card-container');

    // My Containers Page
    const containersListDiv = document.getElementById('containers-list');

    // History Page
    const historyTableBody = document.getElementById('history-table-body');
    const historyChartCanvas = document.getElementById('historyChart');

    // Chat Page
    const chatTemplatesContainer = document.getElementById('chat-templates');
    const chatForm = document.getElementById('chat-form');

    // Navigation & Actions
    const navButtons = document.querySelectorAll('.nav-btn');
    const fabContainer = document.getElementById('fab-container');
    const fab = document.getElementById('fab');
    const fabActions = document.querySelectorAll('.fab-action');
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    
    // Modal
    const modalContainer = document.getElementById('modal-container');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalTitle = document.getElementById('modal-title');
    const orderFormModal = document.getElementById('new-order-form-modal');
    const addressSelectModal = document.getElementById('address-select-modal');
    const getLocationBtn = document.getElementById('get-location-btn');


    // ========== CORE FUNCTIONS ==========

    /**
     * Main initialization function. Checks for a logged-in user or prompts for login.
     */
    function initApp() {
        setupEventListeners();
        updateClock();
        setInterval(updateClock, 1000);
        const storedClientId = localStorage.getItem('saban_client_id');
        if (storedClientId) {
            loadClientData(storedClientId);
        } else {
            promptForClientId();
        }
        if(refreshInterval) clearInterval(refreshInterval);
        refreshInterval = setInterval(() => loadClientData(clientState.id, true), 60000); // Auto-refresh
    }

    /**
     * Fetches all necessary data for the logged-in client from the backend.
     * @param {string} clientId The client's ID.
     * @param {boolean} isRefresh - If true, avoids showing the loading overlay.
     */
    async function loadClientData(clientId, isRefresh = false) {
        if (!clientId) return;
        if (!isRefresh) appContainer.style.opacity = '0.5';
        try {
            const data = await apiGet(`getClientData?clientId=${clientId}`);
            if (!data || !data.clientName) {
                throw new Error("Client not found");
            }

            clientState = {
                id: clientId,
                name: data.clientName,
                orders: data.orders || [],
                addresses: new Set(data.orders.map(o => o['כתובת']).filter(Boolean)),
                historyChart: clientState.historyChart // Preserve chart instance
            };
            
            localStorage.setItem('saban_client_id', clientId);
            
            // Render all sections of the app
            renderHeaderAndGreeting();
            renderHomePage();
            renderContainersPage();
            renderHistoryPage();
            renderChatPage();
            
        } catch (error) {
            console.error("Failed to load client data:", error);
            localStorage.removeItem('saban_client_id');
            alert("שגיאה בטעינת נתוני לקוח. אנא נסה שוב.");
            promptForClientId();
        } finally {
            if (!isRefresh) appContainer.style.opacity = '1';
        }
    }
    
    /**
     * Generic function to fetch data from the Google Apps Script API.
     */
    async function apiGet(queryString) {
        const response = await fetch(`${API_URL}?${queryString}`);
        if (!response.ok) throw new Error('Network response was not ok.');
        return await response.json();
    }
    
    /**
     * Generic function to post data to the Google Apps Script API.
     */
    async function apiPost(body) {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error('Network response was not ok.');
        return await response.json();
    }

    /**
     * Prompts the user to enter their client ID to log in.
     */
    function promptForClientId() {
        const clientId = prompt("שלום! אנא הזן את מספר הלקוח שלך כדי להתחבר:");
        if (clientId && clientId.trim() !== '') {
            loadClientData(clientId.trim());
        } else {
            document.body.innerHTML = `<div style="padding: 20px; text-align: center;"><h1>נדרש מספר לקוח. אנא רענן ונסה שוב.</h1></div>`;
        }
    }
    
    // ========== HEADER & GREETING ==========
    
    function updateClock() {
        const now = new Date();
        clockDiv.textContent = now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        dateDiv.textContent = now.toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' });
    }

    function renderHeaderAndGreeting() {
        clientNameHeader.textContent = clientState.name;
        const hour = new Date().getHours();
        let greeting = "ברוך הבא,";
        if (hour < 12) {
            greeting = "בוקר טוב,";
        } else if (hour < 18) {
            greeting = "צהריים טובים,";
        } else {
            greeting = "ערב טוב,";
        }
        greetingDiv.textContent = `${greeting} ${clientState.name.split(' ')[0]}`;
    }

    // ========== PAGE RENDERING ==========

    function renderHomePage() {
        const activeOrders = clientState.orders.filter(o => o['סטטוס'] !== 'סגור');
        activeOrdersContainer.innerHTML = ''; 

        if (activeOrders.length === 0) {
            noActiveOrdersDiv.style.display = 'block';
            etaCardContainer.style.display = 'none';
        } else {
            noActiveOrdersDiv.style.display = 'none';
            etaCardContainer.style.display = 'block';
            
            const mainOrder = activeOrders[0]; // Assuming one main active order for simplicity
            
            activeOrdersContainer.innerHTML = `
                 <div class="card">
                    <h2 class="card-title">
                       <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.29V15.7a2 2 0 0 1-1.82 2H4.82A2 2 0 0 1 3 15.71V8.29a2 2 0 0 1 .45-1.28L8 2.29a2 2 0 0 1 1.45-.7a2 2 0 0 1 1.45.7l4.55 4.72a2 2 0 0 1 .45 1.28Z"></path><path d="M12 17.71V12"></path></svg>
                        ההזמנה הפעילה שלך
                    </h2>
                    <p style="font-size: 18px; font-weight: 600;">${mainOrder['סוג מכולה'] || 'מכולה'} בכתובת:</p>
                    <p style="font-size: 16px; color: var(--text-light);">${mainOrder['כתובת']}</p>
                </div>
            `;
            
            const eta = mainOrder['זמן הגעה משוער'];
            const driver = mainOrder['שם נהג'];
            if(eta || driver) {
                etaCardContainer.innerHTML = `
                    <div class="eta-card active">
                        <div class="eta-info">
                            <div class="label">${driver ? `הנהג ${driver} בדרך` : 'צפי הגעה'}</div>
                            <div class="value">${eta || 'יצירת קשר בקרוב'}</div>
                        </div>
                        <div class="eta-truck">🚚</div>
                    </div>
                `;
            } else {
                etaCardContainer.innerHTML = `
                     <div class="eta-card">
                        <div class="eta-info">
                            <div class="label">צפי הגעה</div>
                            <div class="value">טרם עודכן</div>
                        </div>
                    </div>
                `;
            }
        }
    }
    
    function renderContainersPage() {
        containersListDiv.innerHTML = '';
        const activeOrdersWithContainers = clientState.orders.filter(o => o['סטטוס'] !== 'סגור' && o['מכולה ירדה']);
        
        if (activeOrdersWithContainers.length === 0) {
            containersListDiv.innerHTML = `<div class="card" style="text-align: center;"><p>אין לך מכולות פעילות כרגע.</p></div>`;
            return;
        }

        activeOrdersWithContainers.forEach(order => {
            const startDate = new Date(order['תאריך']);
            const endDate = new Date(order['תאריך סיום']);
            const now = new Date();
            
            const totalDuration = (endDate - startDate) / (1000 * 3600 * 24);
            const elapsedDuration = (now - startDate) / (1000 * 3600 * 24);
            let progress = Math.min(100, (elapsedDuration / totalDuration) * 100);
            if(isNaN(progress)) progress = 0;

            let progressClass = '';
            if (progress > 85) progressClass = 'danger';
            else if (progress > 60) progressClass = 'warning';

            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: baseline;">
                    <h3 style="font-size: 18px; font-weight: 700;">מכולה ${order['מכולה ירדה']}</h3>
                    <span style="font-size: 14px; color: var(--text-muted);">${order['כתובת']}</span>
                </div>
                <div style="display:flex; justify-content: space-between; font-size: 14px; margin-top: 15px;">
                    <span>התחלה: ${startDate.toLocaleDateString('he-IL')}</span>
                    <span>סיום: ${endDate.toLocaleDateString('he-IL')}</span>
                </div>
                <div class="progress-bar ${progressClass}">
                    <div class="progress-bar-inner" style="width: ${progress}%;"></div>
                </div>
                <p style="text-align: center; margin-top: 10px; font-weight: 600;">
                    נשארו כ-${Math.max(0, Math.round(totalDuration - elapsedDuration))} ימים לסיום
                </p>
            `;
            containersListDiv.appendChild(card);
        });
    }

    function renderHistoryPage() {
        historyTableBody.innerHTML = '';
        clientState.orders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order['מספר תעודה'] || ''}</td>
                <td>${new Date(order['תאריך']).toLocaleDateString('he-IL')}</td>
                <td>${order['סוג פעולה'] || 'הורדה'}</td>
                <td>${order['כתובת'] || ''}</td>
            `;
            historyTableBody.appendChild(row);
        });
        
        if(clientState.historyChart) clientState.historyChart.destroy();
        
        const monthlyData = clientState.orders.reduce((acc, order) => {
            const month = new Date(order['תאריך']).toLocaleDateString('he-IL', { year: '2-digit', month: 'short' });
            acc[month] = (acc[month] || 0) + 1;
            return acc;
        }, {});

        clientState.historyChart = new Chart(historyChartCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(monthlyData),
                datasets: [{
                    label: 'כמות הזמנות', data: Object.values(monthlyData),
                    backgroundColor: 'var(--brand)', borderRadius: 5
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });
    }

    function renderChatPage() {
        chatTemplatesContainer.innerHTML = '';
        CHAT_TEMPLATES.forEach(template => {
            const btn = document.createElement('button');
            btn.className = 'template-btn';
            btn.textContent = template;
            btn.onclick = () => handleChatMessage(template);
            chatTemplatesContainer.appendChild(btn);
        });
    }

    // ========== EVENT HANDLERS & SUBMISSIONS ==========

    function setupEventListeners() {
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                navigateTo(btn.dataset.page);
            });
        });

        fab.addEventListener('click', () => fabContainer.classList.toggle('active'));
        fabActions.forEach(action => {
            action.addEventListener('click', (e) => {
                e.preventDefault();
                openNewOrderModal(action.dataset.action);
                fabContainer.classList.remove('active');
            });
        });
        
        appContainer.addEventListener('scroll', () => {
            if (appContainer.scrollTop > 200) {
                scrollToTopBtn.classList.add('show');
            } else {
                scrollToTopBtn.classList.remove('show');
            }
        });
        scrollToTopBtn.addEventListener('click', () => {
            appContainer.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        modalCloseBtn.addEventListener('click', () => modalContainer.classList.remove('show'));
        orderFormModal.addEventListener('submit', handleNewOrderSubmit);
        chatForm.addEventListener('submit', handleChatSubmit);
        getLocationBtn.addEventListener('click', handleGetLocation);
    }
    
    function navigateTo(pageId) {
        const currentPage = document.querySelector('.page.active');
        const nextPage = document.getElementById(pageId);
        
        if (currentPage === nextPage) return;

        currentPage.classList.add('exiting');
        
        setTimeout(() => {
            currentPage.classList.remove('active');
            currentPage.classList.remove('exiting');
            
            nextPage.classList.add('active');
            navButtons.forEach(b => b.classList.remove('active'));
            document.querySelector(`.nav-btn[data-page="${pageId}"]`).classList.add('active');
            appContainer.scrollTop = 0;
        }, 400);
    }

    function openNewOrderModal(actionType) {
        modalTitle.textContent = `בקשת ${actionType}`;
        orderFormModal.dataset.actionType = actionType;

        addressSelectModal.innerHTML = '';
        clientState.addresses.forEach(address => {
            const option = document.createElement('option');
            option.value = address;
            option.textContent = address;
            addressSelectModal.appendChild(option);
        });
        const newAddressOption = document.createElement('option');
        newAddressOption.value = 'new';
        newAddressOption.textContent = 'כתובת חדשה...';
        addressSelectModal.appendChild(newAddressOption);

        modalContainer.classList.add('show');
    }

    async function handleNewOrderSubmit(e) {
        e.preventDefault();
        const actionType = e.target.dataset.actionType;
        const address = document.getElementById('new-address-modal').value.trim() || addressSelectModal.value;
        const notes = document.getElementById('order-notes-modal').value.trim();
        const location = document.getElementById('location-coords').value;

        if (address === 'new') {
            alert("אנא בחר כתובת קיימת או הקלד כתובת חדשה.");
            return;
        }

        let details = `כתובת: ${address}. הערות: ${notes || 'אין'}.`;
        if(location) details += ` מיקום GPS: ${location}`;

        await sendClientRequest(actionType, details);
        orderFormModal.reset();
        modalContainer.classList.remove('show');
    }
    
    async function handleChatMessage(message) {
        if(message === "מה צפי ההגעה של הנהג?") {
             const activeOrder = clientState.orders.find(o => o['סטטוס'] !== 'סגור');
             const eta = activeOrder ? activeOrder['זמן הגעה משוער'] : null;
             const driver = activeOrder ? activeOrder['שם נהג'] : null;
             if(eta || driver) {
                 const reply = `היי ${clientState.name.split(' ')[0]}, ${driver ? `הנהג ${driver}` : 'הנהג'} בדרך. זמן ההגעה המשוער הוא ${eta || 'בקרוב'}.`;
                  showToast(reply, 'info');
             } else {
                 showToast('המידע על הנהג טרם עודכן, נציג יענה לך בהקדם.', 'info');
             }
        }
        await sendClientRequest('הודעת צאט', message);
    }

    function handleChatSubmit(e) {
        e.preventDefault();
        const messageInput = document.getElementById('chat-message');
        handleChatMessage(messageInput.value);
        messageInput.value = '';
    }
    
    async function sendClientRequest(requestType, details) {
        try {
            const result = await apiPost({
                action: 'clientRequest',
                clientId: clientState.id,
                clientName: clientState.name,
                requestType,
                details
            });
            if (result.status === 'success') {
                showToast("בקשתך נשלחה בהצלחה!", "success");
            } else {
                throw new Error(result.message || 'Unknown error');
            }
        } catch (error) {
            showToast(`שגיאה בשליחת הבקשה: ${error.message}`, "error");
        }
    }

    function handleGetLocation() {
        if (!navigator.geolocation) {
            alert("שירותי מיקום אינם נתמכים בדפדפן זה.");
            return;
        }
        getLocationBtn.textContent = 'מאמת מיקום...';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = `${position.coords.latitude},${position.coords.longitude}`;
                document.getElementById('location-coords').value = coords;
                getLocationBtn.textContent = '✅ מיקום נשמר';
                getLocationBtn.style.backgroundColor = 'var(--success)';
            },
            () => {
                alert("לא ניתן היה לקבל את המיקום. אנא ודא שההרשאות מאושרות.");
                getLocationBtn.textContent = 'הבא אותי לכאן';
            }
        );
    }

    // ========== START APP ==========
    initApp();
});
