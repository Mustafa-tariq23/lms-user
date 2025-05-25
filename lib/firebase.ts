import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyBkFCJnIPPyTpMx0hN6gN1ntBUzX0uwd0E",
  authDomain: "lms-project1.firebaseapp.com",
  projectId: "lms-project1",
  storageBucket: "lms-project1.firebasestorage.app",
  messagingSenderId: "8068352350",
  appId: "1:8068352350:web:4b851b05e84985596267cf",
  measurementId: "G-5H447B26PW",
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
