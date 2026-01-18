import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "./firebaseClient";

// Typet klient-API rundt callable Functions.

export type RequestStatus = {
	found: boolean;
	requestId?: string;
	status?: "pending" | "approved" | "completed" | string;
	uid?: string | null;
	name?: string;
	phone?: string;
	pinSet?: boolean;
};

export type AdminUserWithPin = {
	uid: string;
	name: string;
	phone: string;
	role: "user" | "admin" | (string & {});
	status: string;
	pin: string | null;
};

export async function fnCreateUserRequest(name: string, phone: string, pin: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<
		{ name: string; phone: string; pin: string },
		{ requestId: string; requestKey: string }
	>(f, "createUserRequest");
	const res = await call({ name, phone, pin });
	return res.data;
}

export async function fnCheckRequestStatus(requestKey: string): Promise<RequestStatus> {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ requestKey: string }, RequestStatus>(
		f,
		"checkRequestStatus",
	);
	const res = await call({ requestKey });
	return res.data;
}

export async function fnSetPinWithRequestKey(requestKey: string, pin: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ requestKey: string; pin: string }, { ok: true }>(
		f,
		"setPinWithRequestKey",
	);
	const res = await call({ requestKey, pin });
	return res.data;
}

export async function fnLoginWithPin(pin: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ pin: string }, { token: string }>(f, "loginWithPin");
	const res = await call({ pin });
	return res.data;
}

export async function fnAdminListUsersWithPins() {
	const f = getFirebaseFunctions();
	const call = httpsCallable<unknown, { users: AdminUserWithPin[] }>(
		f,
		"adminListUsersWithPins",
	);
	const res = await call({});
	return res.data;
}

export async function fnAdminChangePin(targetUid: string, newPin: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ targetUid: string; newPin: string }, { ok: true }>(
		f,
		"adminChangePin",
	);
	const res = await call({ targetUid, newPin });
	return res.data;
}

export async function fnApproveUser(requestId: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ requestId: string }, { ok: true }>(f, "approveUser");
	const res = await call({ requestId });
	return res.data;
}
