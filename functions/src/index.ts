import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";

admin.initializeApp();
const db = admin.firestore();

const GENERIC_PIN_ERROR = "Pinkode ikke godkjent – prøv en ny.";

function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin); // tillater ledende null: 0123
}

function sha256(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function randomKey(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

// AES-256-GCM encryption so admin can SEE pin without storing plaintext.
// TODO (manuelt steg via Firebase CLI, ikke i kode):
//   Kjør én gang per miljø:
//     firebase functions:config:set app.aes_key="<base64-encoded 32-byte key>"
//   og deretter redeploy functions. app.aes_key må dekode til akkurat 32 bytes.
function getAesKey(): Buffer {
  const keyB64 = functions.config().app?.aes_key;
  if (!keyB64) throw new Error("Missing functions config: app.aes_key (base64 32 bytes).");
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) throw new Error("app.aes_key must decode to 32 bytes.");
  return key;
}

function encryptPin(pin: string) {
  const key = getAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(pin, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // pack as base64: iv.tag.cipher
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptPin(packedB64: string) {
  const key = getAesKey();
  const packed = Buffer.from(packedB64, "base64");
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

function requireAuth(context: functions.https.CallableContext) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Mangler innlogging.");
  return context.auth.uid;
}

async function requireAdmin(uid: string) {
  const snap = await db.doc(`users/${uid}`).get();
  const d = snap.data();
  if (!snap.exists || d?.status !== "active" || d?.role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Kun admin.");
  }
  return d as any;
}

/**
 * 1) Ny bruker: createUserRequest(name, phone) -> returns requestId + requestKey
 * - requestKey lagres av klient i localStorage
 * - vi lagrer kun hash(requestKey) i Firestore
 */
export const createUserRequest = functions.https.onCall(async (data) => {
  const name = String(data?.name || "").trim();
  const phone = String(data?.phone || "").trim();

  if (name.length < 2 || phone.length < 5) {
    throw new functions.https.HttpsError("invalid-argument", "Ugyldig navn/telefon.");
  }

  const requestKey = randomKey(32);
  const requestKeyHash = sha256(requestKey);

  const ref = await db.collection("userRequests").add({
    name,
    phone,
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    requestKeyHash,
  });

  return { requestId: ref.id, requestKey };
});

/**
 * 2) checkRequestStatus(requestKey)
 * - klient kaller ved oppstart hvis den har requestKey i localStorage
 * - returnerer pending/approved + om PIN er satt
 */
export const checkRequestStatus = functions.https.onCall(async (data) => {
  const requestKey = String(data?.requestKey || "").trim();
  if (!requestKey) throw new functions.https.HttpsError("invalid-argument", "Mangler requestKey.");

  const requestKeyHash = sha256(requestKey);

  const snap = await db
    .collection("userRequests")
    .where("requestKeyHash", "==", requestKeyHash)
    .limit(1)
    .get();
  if (snap.empty) return { found: false };

  const reqDoc = snap.docs[0];
  const req = reqDoc.data() as any;

  const uid = req.uid || null;
  let pinSet = false;

  if (uid) {
    const pinSnap = await db.doc(`userPins/${uid}`).get();
    pinSet = pinSnap.exists && !!(pinSnap.data() as any)?.pinHash;
  }

  return {
    found: true,
    requestId: reqDoc.id,
    status: req.status,
    uid,
    name: req.name,
    phone: req.phone,
    pinSet,
  };
});

/**
 * 3) Admin: approveUser(requestId)
 * - oppretter Auth user + users/{uid}
 * - markerer request approved + binder uid
 */
export const approveUser = functions.https.onCall(async (data, context) => {
  const adminUid = requireAuth(context);
  const adminUser = await requireAdmin(adminUid);

  const requestId = String(data?.requestId || "").trim();
  if (!requestId) throw new functions.https.HttpsError("invalid-argument", "Mangler requestId.");

  const reqRef = db.doc(`userRequests/${requestId}`);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new functions.https.HttpsError("not-found", "Request finnes ikke.");

  const req = reqSnap.data() as any;
  if (req.status !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", "Allerede behandlet.");
  }

  // create auth user
  const authUser = await admin.auth().createUser({
    displayName: req.name,
  });

  // create users doc
  await db.doc(`users/${authUser.uid}`).set({
    name: req.name,
    phone: req.phone,
    role: "user",
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await reqRef.update({
    status: "approved",
    uid: authUser.uid,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvedBy: adminUid,
  });

  await db.collection("activity").add({
    type: "APPROVE_USER",
    at: admin.firestore.FieldValue.serverTimestamp(),
    actorUid: adminUid,
    actorNameSnapshot: adminUser.name,
    summary: `Admin godkjente ${req.name}`,
  });

  return { ok: true };
});

/**
 * 4) setPinWithRequestKey(requestKey, pin)
 * - Bruker er "godkjent", men ikke logget inn ennå.
 * - Bruker setter PIN via requestKey.
 * - PIN må være unik, men vi lekker IKKE informasjon i feilmelding:
 *   alltid "Pinkode ikke godkjent – prøv en ny."
 */
export const setPinWithRequestKey = functions.https.onCall(async (data) => {
  const requestKey = String(data?.requestKey || "").trim();
  const pin = String(data?.pin || "").trim();

  if (!requestKey || !isValidPin(pin)) {
    throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
  }

  const requestKeyHash = sha256(requestKey);
  const reqSnap = await db
    .collection("userRequests")
    .where("requestKeyHash", "==", requestKeyHash)
    .limit(1)
    .get();
  if (reqSnap.empty) throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);

  const reqDoc = reqSnap.docs[0];
  const req = reqDoc.data() as any;

  if (req.status !== "approved" || !req.uid) {
    throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
  }

  const uid = req.uid as string;
  const pinIndexRef = db.doc(`pinIndex/${pin}`);
  const userPinsRef = db.doc(`userPins/${uid}`);
  const userRef = db.doc(`users/${uid}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists || (userSnap.data() as any)?.status !== "active") {
      throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
    }

    const existingPin = await tx.get(pinIndexRef);
    if (existingPin.exists) {
      throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
    }

    const existingUserPins = await tx.get(userPinsRef);
    if (existingUserPins.exists && (existingUserPins.data() as any)?.pinHash) {
      throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
    }

    const pinHash = await bcrypt.hash(pin, 10);
    const pinEnc = encryptPin(pin);

    tx.set(pinIndexRef, {
      uid,
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(userPinsRef, {
      pinHash,
      pinEnc,
      pinLast4: pin,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(reqDoc.ref, {
      status: "completed",
      pinSetAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(db.collection("activity").doc(), {
      type: "SET_PIN",
      at: admin.firestore.FieldValue.serverTimestamp(),
      actorUid: uid,
      actorNameSnapshot: (userSnap.data() as any)?.name ?? "Ukjent",
      summary: `${(userSnap.data() as any)?.name ?? "Bruker"} satte PIN`,
    });
  });

  return { ok: true };
});

/**
 * 5) loginWithPin(pin)
 * - PIN-only login.
 * - Slår opp pinIndex/{pin} -> uid
 * - Verifiserer hash
 * - Returnerer custom token
 * - Samme generiske melding ved feil
 */
export const loginWithPin = functions.https.onCall(async (data) => {
  const pin = String(data?.pin || "").trim();
  if (!isValidPin(pin)) {
    throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
  }

  const pinIndexSnap = await db.doc(`pinIndex/${pin}`).get();
  if (!pinIndexSnap.exists) {
    throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
  }

  const { uid } = pinIndexSnap.data() as any;
  if (!uid) throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);

  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists || (userSnap.data() as any)?.status !== "active") {
    throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
  }

  const pinsSnap = await db.doc(`userPins/${uid}`).get();
  if (!pinsSnap.exists) throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);

  const pins = pinsSnap.data() as any;
  const ok = await bcrypt.compare(pin, pins.pinHash || "");
  if (!ok) throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);

  const token = await admin.auth().createCustomToken(uid);

  await db.collection("activity").add({
    type: "LOGIN",
    at: admin.firestore.FieldValue.serverTimestamp(),
    actorUid: uid,
    actorNameSnapshot: (userSnap.data() as any)?.name ?? "Ukjent",
    summary: `${(userSnap.data() as any)?.name ?? "Bruker"} logget inn`,
  });

  return { token };
});

/**
 * 6) Admin: adminListUsersWithPins()
 * - Returnerer alle users + dekryptert PIN (for adminvisning)
 */
export const adminListUsersWithPins = functions.https.onCall(async (_data, context) => {
  const adminUid = requireAuth(context);
  await requireAdmin(adminUid);

  const usersSnap = await db.collection("users").orderBy("name", "asc").get();
  const results: any[] = [];

  for (const u of usersSnap.docs) {
    const user = u.data() as any;
    const pinsSnap = await db.doc(`userPins/${u.id}`).get();
    let pin: string | null = null;
    if (pinsSnap.exists) {
      const d = pinsSnap.data() as any;
      if (d?.pinEnc) {
        try {
          pin = decryptPin(d.pinEnc);
        } catch {
          pin = null;
        }
      }
    }

    results.push({
      uid: u.id,
      name: user.name ?? "",
      phone: user.phone ?? "",
      role: user.role ?? "user",
      status: user.status ?? "active",
      pin, // kan være null hvis ikke satt
    });
  }

  return { users: results };
});

/**
 * 7) Admin: adminChangePin(targetUid, newPin)
 * - Endrer PIN på en ansatt.
 * - Flytter pinIndex fra gammel til ny
 * - Samme generiske melding ved kollisjon
 */
export const adminChangePin = functions.https.onCall(async (data, context) => {
  const adminUid = requireAuth(context);
  const adminUser = await requireAdmin(adminUid);

  const targetUid = String(data?.targetUid || "").trim();
  const newPin = String(data?.newPin || "").trim();

  if (!targetUid || !isValidPin(newPin)) {
    throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
  }

  const userRef = db.doc(`users/${targetUid}`);
  const userPinsRef = db.doc(`userPins/${targetUid}`);
  const newPinIndexRef = db.doc(`pinIndex/${newPin}`);

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists || (userSnap.data() as any)?.status !== "active") {
      throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
    }

    const newPinIndexSnap = await tx.get(newPinIndexRef);
    if (newPinIndexSnap.exists) {
      throw new functions.https.HttpsError("permission-denied", GENERIC_PIN_ERROR);
    }

    const existingPinsSnap = await tx.get(userPinsRef);
    let oldPin: string | null = null;
    if (existingPinsSnap.exists) {
      const d = existingPinsSnap.data() as any;
      oldPin = d?.pinLast4 ?? null;
    }

    // Remove old pinIndex if exists
    if (oldPin && isValidPin(oldPin)) {
      tx.delete(db.doc(`pinIndex/${oldPin}`));
    }

    const pinHash = await bcrypt.hash(newPin, 10);
    const pinEnc = encryptPin(newPin);

    tx.set(newPinIndexRef, {
      uid: targetUid,
      active: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(
      userPinsRef,
      {
        pinHash,
        pinEnc,
        pinLast4: newPin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    tx.set(db.collection("activity").doc(), {
      type: "ADMIN_CHANGE_PIN",
      at: admin.firestore.FieldValue.serverTimestamp(),
      actorUid: adminUid,
      actorNameSnapshot: adminUser.name,
      summary: `Admin endret PIN for ${(userSnap.data() as any)?.name ?? "bruker"}`,
      targetUid,
    });
  });

  return { ok: true };
});

