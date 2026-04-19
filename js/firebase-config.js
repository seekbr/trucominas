// ═══════════════════════════════════════════════════════
//  FIREBASE CONFIGURATION
//  Instrução: Crie um projeto no Firebase (firebase.google.com)
//  Ative o Realtime Database, copie as credenciais abaixo.
// ═══════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyAeWH-xmr-t_UiKduqMbW89xyz7nErwsbc",
  authDomain: "trucominas.firebaseapp.com",
  databaseURL: "https://trucominas-default-rtdb.firebaseio.com",
  projectId: "trucominas",
  storageBucket: "trucominas.firebasestorage.app",
  messagingSenderId: "121756175678",
  appId: "1:121756175678:web:c2a7b7f961c4d2521d706f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ─── Database rules (copie para o Firebase Console) ───
/*
{
  "rules": {
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
*/
