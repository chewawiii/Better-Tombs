export const CONFIG_PREFIX = "tombs:config";
export const OPERATOR_CONFIG = {
	announceDeath: true,

	maxTombsPerPlayer: 5, // 0 (No Limit) | 0 - 8 | 1 each step

	protectionDuration: 15, // 0 (No Protection) | 0 - 15 minutes | 3 min each step

	intruderCurseLevel: "normal", // 0 none | 1 easy | 2 normal | 3 hard | 4 extreme
	intruderCurseEntityType: "zombie",
	intruderCurseEffectType: "slowness",

	operatorBypassProtection: false,
};

export const MEMBER_CONFIG = {
	itemChanceRate: "low", // 0 (No Compass) | 0 - 3 | chance = player level * rate

	confirmTeleport: true,
	showEffects: true,

	/*showTombDistance: true,
	showTombCoordinates: true,
	showTombProtectionTime: true,*/
};

export const TOMBS = ["tombs:tombstone_1", "tombs:tombstone_2"];

export const ITEM_RATE = ["none", "low", "medium", "high"];
export const CURSE_LEVELS = ["none", "easy", "normal", "hard", "extreme"];
export const CURSE_ENTITIES = ["zombie", "husk", "skeleton", "vex"];
export const CURSE_EFFECTS = ["slowness", "weakness", "blindness", "darkness", "poison", "nausea"];
