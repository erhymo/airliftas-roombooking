"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
	collection,
	addDoc,
	getDocs,
	query,
	where,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import AppShell from "@/components/AppShell";
import { firebaseAuth, firebaseDb, firebaseStorage } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";
import { fnSyncMedicalToOpscom } from "@/lib/functions";

type MedicalItem = {
	id: string;
	storagePath: string;
	downloadUrl: string | null;
	createdAt: Date | null;
};

export default function MedicalCertificatesPage() {
	const router = useRouter();
	const [checkingAuth, setCheckingAuth] = useState(true);
	const [loading, setLoading] = useState(true);
	const [items, setItems] = useState<MedicalItem[]>([]);
	const [msg, setMsg] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		const auth = firebaseAuth();
		const db = firebaseDb();
		const unsub = auth.onAuthStateChanged((user) => {
			(void (async () => {
				if (!user || isSessionExpired()) {
					setCheckingAuth(false);
					setLoading(false);
					setItems([]);
					setError(null);
					router.replace("/");
					return;
				}

				setCheckingAuth(false);
				setLoading(true);
				setError(null);

				try {
					const q = query(
						collection(db, "medicalCertificates"),
						where("uid", "==", user.uid),
					);
					const snap = await getDocs(q);
					const docs: MedicalItem[] = [];
					for (const docSnap of snap.docs) {
						const d = docSnap.data() as any;
						const createdAt =
							d.createdAt instanceof Timestamp
								? d.createdAt.toDate()
								: null;
						docs.push({
							id: docSnap.id,
							storagePath: typeof d.storagePath === "string" ? d.storagePath : "",
							downloadUrl:
								typeof d.downloadUrl === "string" ? d.downloadUrl : null,
							createdAt,
						});
					}
					docs.sort((a, b) => {
						const ta = a.createdAt?.getTime() ?? 0;
						const tb = b.createdAt?.getTime() ?? 0;
						return tb - ta;
					});
					setItems(docs);
				} catch (e) {
					console.error("Kunne ikke hente medical-dokumenter", e);
					setError("Klarte ikke å hente medical akkurat nå.");
				} finally {
					setLoading(false);
				}
			})());
		});
		return () => unsub();
	}, [router]);

	const handleClickAddNew = () => {
		setMsg(null);
		setError(null);
		if (fileInputRef.current) {
			fileInputRef.current.click();
		}
	};

	const handleFileChange = async (
		e: ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0] ?? null;
		if (!file) return;

		setUploading(true);
		setMsg(null);
		setError(null);

		try {
			const auth = firebaseAuth();
			const db = firebaseDb();
			const storage = firebaseStorage();
			const user = auth.currentUser;

			if (!user || isSessionExpired()) {
				router.replace("/");
				return;
			}

			const uid = user.uid;
			const now = new Date();
			const ext = file.name.split(".").pop() || "jpg";
			const path = `medical/${uid}/${Date.now()}.${ext}`;
			const storageRef = ref(storage, path);

			await uploadBytes(storageRef, file);
			const downloadUrl = await getDownloadURL(storageRef);

			const docRef = await addDoc(collection(db, "medicalCertificates"), {
				uid,
				storagePath: path,
				downloadUrl,
				createdAt: serverTimestamp(),
			});

			const newItem: MedicalItem = {
				id: docRef.id,
				storagePath: path,
				downloadUrl,
				createdAt: now,
			};
			setItems((prev) => [newItem, ...prev]);

			try {
				await fnSyncMedicalToOpscom({
					storagePath: path,
					downloadUrl,
					uploadedAt: now.toISOString(),
				});
			} catch (err) {
				// Vi logger bare til konsoll – brukeren trenger ikke feilmelding hvis Opscom-kallet feiler.
				console.warn("syncMedicalToOpscom feilet", err);
			}

			setMsg("Medical er lastet opp.");
		} catch (err) {
			console.error("Kunne ikke laste opp medical", err);
			setError("Kunne ikke laste opp medical. Prøv igjen.");
		} finally {
			setUploading(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	if (checkingAuth) {
		return (
			<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
				<div className="mx-auto max-w-4xl">
					<p className="text-sm text-zinc-600">Laster…</p>
				</div>
			</main>
		);
	}

	return (
		<AppShell title="Medical" subtitle="Oversikt over tidligere medical og opplasting" backHref="/certificates">
			<div className="space-y-4">
				<p className="text-sm leading-relaxed text-zinc-900">
					Her kan du se tidligere medical som er lastet opp, og legge til et nytt
					medical ved å ta bilde eller velge fra kamerarull.
				</p>

				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={handleClickAddNew}
						disabled={uploading}
						className="inline-flex items-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
					>
						{uploading ? "Laster opp…" : "Legg til ny"}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						capture="environment"
						className="hidden"
						onChange={handleFileChange}
					/>
				</div>

				{loading && (
					<p className="text-sm text-zinc-700">Henter medical…</p>
				)}

				{msg && !loading && (
					<p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
						{msg}
					</p>
				)}

				{error && !loading && (
					<p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
						{error}
					</p>
				)}

				{!loading && items.length === 0 && !error && (
					<p className="text-sm text-zinc-700">
						Du har ikke lastet opp noen medical ennå.
					</p>
				)}

				{items.length > 0 && (
					<ul className="space-y-3">
						{items.map((item) => (
							<li
								key={item.id}
								className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2"
							>
								<div className="space-y-0.5">
									<p className="text-sm font-medium text-zinc-900">
										Medical
									</p>
									{item.createdAt && (
										<p className="text-xs text-zinc-600">
											Lastet opp {item.createdAt.toLocaleString("nb-NO", {
												dateStyle: "short",
												timeStyle: "short",
											})}
										</p>
									)}
								</div>
								{item.downloadUrl && (
									<a
										href={item.downloadUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs font-medium text-sky-700 underline underline-offset-2"
									>
										Åpne
									</a>
								)}
							</li>
						))}
					</ul>
				)}
			</div>
		</AppShell>
	);
}
