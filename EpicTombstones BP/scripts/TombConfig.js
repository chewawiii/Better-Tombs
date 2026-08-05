export const PREFIX = "tombs:config";

export const TOMBS = ["tombs:tombstone_1", "tombs:tombstone_2"];

export const ITEM_RATE = ["none", "low", "medium", "high"];
export const CURSE_LEVELS = ["easy", "normal", "hard", "extreme"];
export const CURSE_ENTITIES_TYPES = ["zombie", "husk", "skeleton", "vex"];
export const CURSE_EFFECTS_TYPES = ["slowness", "weakness", "blindness", "darkness", "poison", "nausea"];

/**
 * @typedef {object} SYSTEM_CONFIG
 * @property {boolean} announceDeath
 * @property {number} maxTombsPerPlayer
 * @property {boolean} activateProtection
 * @property {number} protectionDuration
 * @property {boolean} operatorBypassProtection
 * @property {boolean} activateIntruderCurse
 * @property {string} intruderCurseLevel
 * @property {string} intruderCurseEntityType
 * @property {string} intruderCurseEffectType
 */
export const SYSTEM_CONFIG = {
	announceDeath: true,

	maxTombsPerPlayer: 0,

	activateProtection: true,
	protectionDuration: 10,
	operatorBypassProtection: false,

	activateIntruderCurse: true,
	intruderCurseLevel: "normal",
	intruderCurseEntityType: "zombie",
	intruderCurseEffectType: "slowness",
};

/**
 * @typedef {object} PLAYER_CONFIG
 * @property {string} itemChanceRate
 * @property {boolean} showHud
 * @property {boolean} showLocatorBar
 */
export const PLAYER_CONFIG = {
	itemChanceRate: "low",

	showHud: true,
	showLocatorBar: true,
};
