import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "./firebaseClient";

// Typet klient-API rundt callable Functions.

export type AdminUserWithPin = {
	uid: string;
	name: string;
	phone: string;
	role: "user" | "admin" | (string & {});
	status: string;
		hasPin: boolean;
};

export async function fnCreateUserRequest(
	name: string,
	phone: string,
	pin: string,
) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<
		{ name: string; phone: string; pin: string },
			{ requestId: string }
	>(f, "createUserRequest");
	const res = await call({ name, phone, pin });
	return res.data;
}

export async function fnLoginWithPin(pin: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ pin: string }, { token: string }>(
		f,
		"loginWithPin",
	);
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
	const call = httpsCallable<
		{ targetUid: string; newPin: string },
		{ ok: true }
	>(f, "adminChangePin");
	const res = await call({ targetUid, newPin });
	return res.data;
}

	export async function fnAdminDeleteUser(targetUid: string) {
		const f = getFirebaseFunctions();
		const call = httpsCallable<{ targetUid: string }, { ok: true }>(
			f,
			"adminDeleteUser",
		);
		const res = await call({ targetUid });
		return res.data;
	}

export async function fnApproveUser(requestId: string) {
	const f = getFirebaseFunctions();
	const call = httpsCallable<{ requestId: string }, { ok: true }>(
		f,
		"approveUser",
	);
	const res = await call({ requestId });
	return res.data;
}
