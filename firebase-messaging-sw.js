// Import the Firebase scripts that are needed.
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// ⭐️⭐️⭐️ הדבק כאן את אובייקט ה-firebaseConfig שלך ⭐️⭐️⭐️
const firebaseConfig = {
    apiKey: "AIzaSyDy3k1AoEKeuCKjmFxefn9fapeqv2Le1_w",
    authDomain: "hsaban94-cc777.firebaseapp.com",
    databaseURL: "https://hsaban94-cc777.firebaseio.com",
    projectId: "hsaban94-cc777",
    storageBucket: "hsaban94-cc777.appspot.com",
    messagingSenderId: "299206369469",
    appId: "1:299206369469:web:7527baa329def3a29457d4",
    measurementId: "G-J2N5Z54MBL"
};

// Initialize the Firebase app in the service worker with the provided config.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Retrieve an instance of Firebase Messaging so we can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: 'https://img.icons8.com/?size=192&id=9fZ3EWahbXyH&format=png&color=000000'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
