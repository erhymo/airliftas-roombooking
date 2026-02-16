export type BaseId = "bergen" | "bringeland" | "kinsarvik";

export type BergenRoomId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export type BringelandRoomId =
	| "R1"
	| "R2"
	| "R3"
	| "R4"
	| "R5"
	| "R6"
	| "R7"
	| "R8"
	| "R9"
	| "R10"
	| "R11"
	| "R12";

export type KinsarvikRoomId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6";

export interface BookingBase<TBaseId extends BaseId, TRoomId extends string> {
	id: string;
	baseId: TBaseId;
	roomId: TRoomId;
	roomName: string;
	name: string;
	from: Date;
	to: Date;
	createdByUid: string;
	createdByName: string;
}

