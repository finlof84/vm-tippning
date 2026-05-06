import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA3oWZWXnVWWlUZYMi60ptGNmo6xCCqQjE",
  authDomain: "vm-tipning.firebaseapp.com",
  projectId: "vm-tipning",
  storageBucket: "vm-tipning.firebasestorage.app",
  messagingSenderId: "1009857986691",
  appId: "1:1009857986691:web:0a85d6ad5dbc4a892adbb6",
  measurementId: "G-C1FFREKFDC"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
