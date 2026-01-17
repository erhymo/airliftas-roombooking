# Firebase Cloud Functions - PIN Kryptering

Dette prosjektet inneholder Firebase Cloud Functions for sikker PIN-kryptering og -verifisering.

## 🔐 Funksjoner

### 1. `onUserCreate` (Firestore Trigger)
Automatisk kryptering av PIN når en ny bruker opprettes i Firestore.

**Trigger:** `users/{userId}` dokument opprettet
**Handling:** Krypterer `pin`-feltet og lagrer det som `pinEncrypted`, deretter sletter ukryptert PIN.

### 2. `verifyPin` (Callable Function)
Verifiserer om en oppgitt PIN matcher den lagrede krypterte PIN-en.

**Input:**
```json
{
  "userId": "bruker-id",
  "pin": "1234"
}
```

**Output:**
```json
{
  "valid": true
}
```

### 3. `getDecryptedPin` (Callable Function - Kun Admin)
Henter dekryptert PIN for en bruker. Kun tilgjengelig for administratorer.

**Input:**
```json
{
  "userId": "bruker-id"
}
```

**Output:**
```json
{
  "pin": "1234"
}
```

**Merk:** Krever at brukeren er registrert i `admins`-kolleksjonen i Firestore.

## 🚀 Oppsett

### 1. Installer avhengigheter
```bash
cd functions
npm install
```

### 2. Konfigurer AES-nøkkel i Firebase

Sett AES-nøkkelen i Firebase Functions config (kjøres i rotmappen for prosjektet):

```bash
firebase functions:config:set app.aes_key="DIN_BASE64_NØKKEL_HER"
```

Du kan generere en 32-byte nøkkel slik:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Bygg TypeScript-koden
```bash
npm run build
```

### 4. Deploy til Firebase
```bash
firebase deploy --only functions
```

## 📝 Bruk i appen din

### Verifiser PIN (fra klient-app)
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const verifyPin = httpsCallable(functions, 'verifyPin');

const result = await verifyPin({ 
  userId: 'user123', 
  pin: '1234' 
});

if (result.data.valid) {
  console.log('PIN er korrekt!');
} else {
  console.log('Feil PIN');
}
```

### Hent dekryptert PIN (kun admin)
```typescript
const getDecryptedPin = httpsCallable(functions, 'getDecryptedPin');

const result = await getDecryptedPin({ userId: 'user123' });
console.log('Dekryptert PIN:', result.data.pin);
```

## 🔒 Sikkerhet

- PIN-koder krypteres med AES-256-CBC
- AES-nøkkelen lagres i Firebase Functions config (`functions.config().app.aes_key`)
- Kun administratorer kan dekryptere PIN-koder
- Ukrypterte PIN-koder slettes automatisk fra Firestore

## 📦 Kommandoer

- `npm run build` - Kompiler TypeScript
- `npm run serve` - Kjør functions lokalt med emulator
- `npm run deploy` - Deploy til Firebase
- `npm run logs` - Vis function logs

## ⚠️ Viktig

- **ALDRI** commit `.env`-filen til Git
- Sørg for at kun autoriserte administratorer har tilgang til `getDecryptedPin`
- Implementer din egen admin-sjekk i `getDecryptedPin`-funksjonen

