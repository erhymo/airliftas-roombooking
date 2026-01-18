import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";
import { getFirestore, type Firestore } from "firebase/firestore";

// Les konfig fra Next.js sine public env-variabler (defineres i web/.env.local).
// Merk: disse verdiene blir bundet ved build-tid i Next.js.
// TODO (manuelt steg): sett samme NEXT_PUBLIC_FIREBASE_* i både web/.env.local
// og som Environment Variables i Vercel-prosjektet for web-appen.
const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.appId) {
	throw new Error("Missing Firebase config env vars (NEXT_PUBLIC_FIREBASE_*)");
}

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;
  if (getApps().length) {
    _app = getApp();
  } else {
    _app = initializeApp(firebaseConfig);
  }
  return _app;
}

let _auth: Auth | null = null;
export function getFirebaseAuth(): Auth {
	if (_auth) return _auth;
	_auth = getAuth(getFirebaseApp());
	return _auth;
}

// For enkel bruk der du vil ha en funksjon kalt firebaseAuth()
export function firebaseAuth(): Auth {
	return getFirebaseAuth();
}

let _db: Firestore | null = null;
export function getFirebaseDb(): Firestore {
	if (_db) return _db;
	_db = getFirestore(getFirebaseApp());
	return _db;
}

export function firebaseDb(): Firestore {
	return getFirebaseDb();
}

let _functions: Functions | null = null;
export function getFirebaseFunctions(): Functions {
	if (_functions) return _functions;
	// Funksjonene våre er deployet i us-central1
	_functions = getFunctions(getFirebaseApp(), "us-central1");
	return _functions;
}

// Alias med samme navn som i noen eksempelsnutter
export function firebaseFunctions(): Functions {
	return getFirebaseFunctions();
}

