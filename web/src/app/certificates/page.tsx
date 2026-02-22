"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import AppShell from "@/components/AppShell";
import { firebaseAuth } from "@/lib/firebaseClient";
import { isSessionExpired } from "@/lib/session";

type CertificateItem = {
	title: string;
	description?: string;
	category: string;
	followUp: string; // f.eks. "31.05.2026" eller "-" for ingen oppfølging
};

	// Manuelt tolket fra skjermbildet ditt – én rad per aktiv godkjenning.
	// Datoer og kategorier er hentet direkte; datofelt "-" betyr ingen fast oppfølging.
	const EXAMPLE_CERTIFICATES: CertificateItem[] = [
		{
			title: "Emergency and safety equipment AW 169 - Emergency and safety equipment",
			category: "Recurrent Training",
			followUp: "31.03.2026",
		},
		{
			title: "CPL H IR - CPL H IR",
			category: "Certificates",
			followUp: "31.03.2026",
		},
		{
			title: "OPC AW 169 - Operators Proficiency Check",
			category: "Recurrent Training",
			followUp: "31.03.2026",
		},
		{
			title: "PC AW 169 - PC 169",
			category: "Recurrent Training",
			followUp: "31.03.2026",
		},
		{
			title: "Survival Suite Hansen Protection - Annual certification of survival suite",
			category: "Certificates",
			followUp: "31.05.2026",
		},
		{
			title: "Line Check AW 169 - Line check 169",
			category: "Recurrent Training",
			followUp: "31.10.2026",
		},
		{
			title: "NVIS - Proficiency Check - NVIS - Proficiency Check",
			category: "Recurrent Training",
			followUp: "30.11.2026",
		},
		{
			title: "Medical Class 1 o/40 years MP - Annual",
			category: "Medical",
			followUp: "14.01.2027",
		},
		{
			title: "SMS Recurrent Training - Annual",
			category: "Recurrent Training",
			followUp: "31.01.2027",
		},
		{
			title: "Ground and refresher training AW 169 - Ground and refresher training AW 169",
			category: "Recurrent Training",
			followUp: "31.01.2027",
		},
		{
			title: "Accidents and Incident Review - Annual",
			category: "Recurrent Training",
			followUp: "31.01.2027",
		},
		{
			title: "CRM - 12 months",
			category: "Recurrent Training",
			followUp: "31.01.2027",
		},
		{
			title: "Survival Suite Hansen Protection - Annual certification of survival suite",
			category: "Certificates",
			followUp: "18.02.2027",
		},
		{
			title: "Dangerous Goods - Bi-annual",
			category: "Recurrent Training",
			followUp: "31.03.2027",
		},
		{
			title: "Helicopter Under Water Evacuation - Three Year Interval",
			category: "Recurrent Training",
			followUp: "31.01.2028",
		},
		{
			title: "First-Aid - Tri-annual",
			category: "Recurrent Training",
			followUp: "31.01.2028",
		},
		{
			title: "Fire/Smoke - Tri-annual",
			category: "Recurrent Training",
			followUp: "31.01.2028",
		},
		{
			title: "Route/Role/Area Competence -General - 36 month",
			category: "Recurrent Training",
			followUp: "31.03.2028",
		},
		{
			title: "MM ID Card - Long interval",
			category: "Other",
			followUp: "30.09.2029",
		},
		{
			title: "English Level Proficiency - Variable",
			category: "Recurrent Training",
			followUp: "31.10.2030",
		},
		{
			title: "PBN",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Opscom Basic Course (internal)",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Management Systems",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Conversion Ground Course",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Loadmaster Course",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Diff. Training B3 to B2",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Maintenance Check Flight Pilot Level A",
			category: "Qualifications",
			followUp: "-",
		},
		{
			title: "SMS Course",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "SCA Course",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "SPO instructor",
			category: "Instructor Rating",
			followUp: "-",
		},
		{
			title: "Skytetrening",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Familiarisation Course AS350",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "Co-Pilot Course",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "CAT Operations",
			category: "Qualifications",
			followUp: "-",
		},
		{
			title: "Maintenance Check Flight Pilot Level B",
			category: "Qualifications",
			followUp: "-",
		},
		{
			title: "Commander Course AS350",
			category: "Courses",
			followUp: "-",
		},
		{
			title: "MARINE PILOT / HELICOPTER HOISTING OPERATIONS",
			category: "Qualifications",
			followUp: "-",
		},
		{
			title: "Difference training AW-169",
			category: "Courses",
			followUp: "-",
		},
	];

export default function CertificatesPage() {
	const router = useRouter();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		const auth = firebaseAuth();
		const unsub = auth.onAuthStateChanged((user) => {
			if (!user || isSessionExpired()) {
				router.replace("/");
			} else {
				setChecking(false);
			}
		});
		return () => unsub();
	}, [router]);

	if (checking) {
		return (
			<main className="min-h-screen bg-zinc-50 p-6 text-zinc-900">
				<div className="mx-auto max-w-4xl">
					<p className="text-sm text-zinc-600">Laster…</p>
				</div>
			</main>
		);
	}

	return (
		<AppShell title="Sertifikater og utsjekker" backHref="/home">
			<div className="space-y-6">
				<section className="space-y-2">
					<h2 className="text-base font-semibold text-zinc-900">
						Oversikt over dine sertifikater
					</h2>
					<p className="text-sm leading-relaxed text-zinc-900">
						Her samler vi sertifikater, utsjekker og kurs slik at du enkelt ser
						hva som er gyldig, hva som snart utløper og hva som mangler.
					</p>
					<p className="text-xs text-zinc-600">
						Tabellen under er bygd for å speile oversikten i Excel/skjermbildene
						du sendte. Rekkefølge og innhold kan justeres når vi legger inn den
						fulle listen fra LOS-systemet.
					</p>
					<p className="text-xs text-zinc-600">
						Du kan trykke på raden for Medical for å komme til en egen side for
						å laste opp medical-dokumentasjon.
					</p>
				</section>

				<section className="space-y-3 rounded-2xl border bg-white p-4">
					<div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
						<h3 className="text-sm font-semibold text-zinc-900">
							Sertifikater, trening og kurs
						</h3>
						<p className="text-xs text-zinc-600">
							Kolonnetitler fra skjermbildet: "Tittel godkjenning",
							"Godkjenningskategori" og "Oppfølging".
						</p>
					</div>

					<div>
						<table className="w-full table-fixed text-sm">
							<thead className="border-b text-left text-zinc-800">
								<tr>
									<th className="py-2 pr-2 align-bottom text-xs font-semibold text-zinc-700">
										Tittel godkjenning
									</th>
									<th className="py-2 pr-2 align-bottom text-xs font-semibold text-zinc-700">
										Godkjenningskategori
									</th>
									<th className="py-2 align-bottom text-xs font-semibold text-zinc-700">
										Oppfølging
									</th>
								</tr>
							</thead>
							<tbody>
								{EXAMPLE_CERTIFICATES.map((c) => (
									<tr key={`${c.title}-${c.category}`} className="border-b last:border-0">
									<td className="py-2 pr-2 align-top">
										{c.category === "Medical" ? (
											<button
												type="button"
												onClick={() => router.push("/certificates/medical")}
												className="text-left"
											>
												<div className="text-sm font-semibold text-sky-700 underline underline-offset-2">
													{c.title}
												</div>
												{c.description && (
													<p className="text-xs text-zinc-600">{c.description}</p>
												)}
											</button>
										) : (
											<>
												<div className="text-sm font-medium text-zinc-900">
													{c.title}
												</div>
												{c.description && (
													<p className="text-xs text-zinc-600">{c.description}</p>
												)}
											</>
										)}
									</td>
										<td className="py-2 pr-2 align-top text-xs text-zinc-800">
											{c.category === "Medical" ? (
												<Link
													href="/certificates/medical"
													className="text-sky-700 underline underline-offset-2"
												>
													{c.category}
												</Link>
											) : (
												c.category
											)}
										</td>
										<td className="py-2 align-top text-xs text-zinc-800">
											{c.followUp}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="pt-2 text-xs text-zinc-600">
						Antall aktive godkjenninger: {EXAMPLE_CERTIFICATES.length}
					</p>
				</section>
			</div>
		</AppShell>
	);
}

