importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Los valores de configuración deben coincidir con src/firebase/config.ts
// Nota: En un entorno real de producción, estos valores se pueden inyectar mediante el proceso de build
// o servir un archivo dinámico.
firebase.initializeApp({
  apiKey: "AIzaSy...", // Reemplazar con el valor real si es necesario o dejar que Firebase lo detecte si ya está en el dominio
  authDomain: "performa-sudinco.firebaseapp.com",
  projectId: "performa-sudinco",
  storageBucket: "performa-sudinco.appspot.com",
  messagingSenderId: "...", // Reemplazar con el valor real de NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
  appId: "..." // Reemplazar con el valor real de NEXT_PUBLIC_FIREBASE_APP_ID
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://i.postimg.cc/sgYg2NKd/icono-performa.png',
    badge: 'https://i.postimg.cc/sgYg2NKd/icono-performa.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
