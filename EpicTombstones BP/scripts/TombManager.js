import { LocationWaypoint, Player, system, WaypointTexture, world } from "@minecraft/server";
import { PLAYER_CONFIG, PREFIX, SYSTEM_CONFIG } from "./TombConfig.js";

const waypointMap = new Map();

export class TombManager {
	/** @param {Player} player */
	constructor(player, blockLocation) {
		this.player = player;
		this.dimension = player.dimension;
		this.blockLocation = blockLocation;
		this._tombId = makeTombId(this.dimension.id, this.blockLocation);
	}

	get tombId() {
		return this._tombId;
	}
	get fetchTomb() {
		const raw = world.getDynamicProperty(this.tombId);
		return raw ? JSON.parse(raw) : null;
	}
	static getTombIds(player) {
		const raw = world.getDynamicProperty(`tombs:${player.name}`);
		return raw ? JSON.parse(raw) : [];
	}

	/** @returns {SYSTEM_CONFIG} */
	static getSystemConfig() {
		return getConfig();
	}
	/** @returns {PLAYER_CONFIG} */
	static getPlayerConfig(player) {
		return getConfig(player);
	}

	registerTomb(hasItems) {
		const config = TombManager.getSystemConfig();
		const protection =
			config.protectionDuration > 0 && config.activateProtection
				? system.currentTick + config.protectionDuration * 60 * 20
				: 0;

		world.setDynamicProperty(
			this.tombId,
			JSON.stringify({
				structureId: hasItems ? this.tombId : undefined,
				ownerName: this.player.name,
				savedXp: this.player.getTotalXp() + 1,
				protectEnd: protection,
			}),
		);
		this._addTombToPlayer(this.tombId, config.maxTombsPerPlayer);
	}

	_addTombToPlayer(tombId, maxTombs) {
		const prefix = `tombs:${this.player.name}`;
		const raw = world.getDynamicProperty(prefix);
		const tombs = raw ? JSON.parse(raw) : [];

		tombs.push(tombId);

		if (maxTombs > 0) {
			while (tombs.length > maxTombs) {
				const oldTombId = tombs.shift();
				TombManager.deleteTomb(oldTombId);
			}
		}
		world.setDynamicProperty(prefix, JSON.stringify(tombs));

		addWaypoint(this.player, this.dimension, this.blockLocation, tombId);
	}

	static deleteTomb(tombId) {
		const raw = world.getDynamicProperty(tombId);
		if (!raw) return;

		const tomb = JSON.parse(raw);
		if (tomb.structureId) {
			world.structureManager.delete(tomb.structureId);
		}

		const [dimName, rawLocation] = tombId.split(":");
		const [x, y, z] = rawLocation.split("_").map(Number);

		world.getDimension(dimName).setBlockType({ x, y, z }, "air");
		world.setDynamicProperty(tombId, undefined);

		const ownerPrefix = `tombs:${tomb.ownerName}`;
		const listRaw = world.getDynamicProperty(ownerPrefix);
		if (!listRaw) return;
		const tombs = JSON.parse(listRaw).filter((id) => id !== tombId);
		world.setDynamicProperty(ownerPrefix, JSON.stringify(tombs));

		removeWaypoint(tombId, tomb.ownerName);
	}
}

function makeTombId(dimensionId, location) {
	const dimName = dimensionId.split(":")[1];
	return `${dimName}:${location.x}_${location.y}_${location.z}`;
}

function getConfig(target = world) {
	const defaultConfig = target instanceof Player ? PLAYER_CONFIG : SYSTEM_CONFIG;
	const raw = target.getDynamicProperty(PREFIX);

	if (!raw) {
		target.setDynamicProperty(PREFIX, JSON.stringify(defaultConfig));
		return { ...defaultConfig };
	}

	const savedConfig = JSON.parse(raw);
	const config = { ...defaultConfig, ...savedConfig };

	const savedKeys = Object.keys(savedConfig);
	const mergedKeys = Object.keys(config);
	if (mergedKeys.length !== savedKeys.length) {
		target.setDynamicProperty(PREFIX, JSON.stringify(config));
	}

	return config;
}

function makeWaypoint(dimension, location) {
	const texture = {
		textureBoundsList: [
			{
				lowerBound: 0,
				texture: {
					iconHeight: 1,
					iconWidth: 1,
					path: "textures/skull.png",
				},
			},
		],
	};
	const waypoint = new LocationWaypoint(
		{ dimension: dimension, x: location.x, y: location.y, z: location.z },
		texture,
	);
	return waypoint;
}

function addWaypoint(player, dimension, location, tombId) {
	const waypoint = makeWaypoint(dimension, location);
	waypointMap.set(tombId, waypoint);
	player.locatorBar.addWaypoint(waypoint);
}

function removeWaypoint(tombId, ownerName) {
	const waypoint = waypointMap.get(tombId);
	if (waypoint) {
		world
			.getAllPlayers()
			.filter((p) => p.name === ownerName)
			.forEach((p) => p.locatorBar.removeWaypoint(waypoint));
		waypointMap.delete(tombId);
	}
}
