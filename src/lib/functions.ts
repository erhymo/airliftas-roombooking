import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "./firebaseClient";

export async function fnCreateUserRequest(name: string, phone: string) {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "createUserRequest");
  const res: any = await call({ name, phone });
  return res.data as { requestId: string; requestKey: string };
}

export async function fnCheckRequestStatus(requestKey: string) {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "checkRequestStatus");
  const res: any = await call({ requestKey });
  return res.data as any;
}

export async function fnSetPinWithRequestKey(requestKey: string, pin: string) {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "setPinWithRequestKey");
  const res: any = await call({ requestKey, pin });
  return res.data as { ok: true };
}

export async function fnLoginWithPin(pin: string) {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "loginWithPin");
  const res: any = await call({ pin });
  return res.data as { token: string };
}

export async function fnAdminListUsersWithPins() {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "adminListUsersWithPins");
  const res: any = await call({});
  return res.data as { users: any[] };
}

export async function fnAdminChangePin(targetUid: string, newPin: string) {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "adminChangePin");
  const res: any = await call({ targetUid, newPin });
  return res.data as { ok: true };
}

export async function fnApproveUser(requestId: string) {
  const f = getFirebaseFunctions();
  const call = httpsCallable(f, "approveUser");
  const res: any = await call({ requestId });
  return res.data as { ok: true };
}

