import { system, world } from "@minecraft/server";
import { CONFIG_PREFIX, MEMBER_CONFIG, OPERATOR_CONFIG } from "./config.js";

export class TombRegistry {
	constructor(player, blockLocation) {
		this.player = player;
		this.dimension = player.dimension;
		this.blockLocation = blockLocation;
	}
	static getOperatorConfig() {
		const raw = world.getDynamicProperty(CONFIG_PREFIX);
		return raw ? JSON.parse(raw) : OPERATOR_CONFIG;
	}
	static getMemberConfig(player) {
		const raw = player.getDynamicProperty(CONFIG_PREFIX);
		return raw ? JSON.parse(raw) : MEMBER_CONFIG;
	}
	makeTombId() {
		const dimName = this.dimension.id.split(":")[1];
		return `${dimName}:${this.blockLocation.x}|${this.blockLocation.y}|${this.blockLocation.z}`;
	}
	registerTomb(hasItems) {
		const id = this.makeTombId();
		const structureId = hasItems ? id : undefined;
		const config = TombRegistry.getOperatorConfig();
		const protectDur =
			config.protectionDuration > 0
				? system.currentTick + config.protectionDuration * 60 * 20
				: system.currentTick;
		world.setDynamicProperty(
			id,
			JSON.stringify({
				structureId: structureId,
				ownerName: this.player.name,
				savedXp: this.player.getTotalXp(),
				protectEnd: protectDur,
			}),
		);
		this.addTombToPlayerList(id, config.maxTombsPerPlayer);
	}
	fetchTomb() {
		const id = this.makeTombId();
		const raw = world.getDynamicProperty(id);
		if (!raw) return null;
		return JSON.parse(raw);
	}
	deleteTomb() {
		const id = this.makeTombId();

		const tombs = this.getPlayerTombs().filter((tombId) => tombId !== id);
		this.setPlayerTombs(tombs);

		world.setDynamicProperty(id, undefined);
	}
	getPlayerTombsId() {
		return `${CONFIG_PREFIX}:Tombs:${this.player.name}`;
	}

	getPlayerTombs() {
		const raw = world.getDynamicProperty(this.getPlayerTombsId());
		return raw ? JSON.parse(raw) : [];
	}

	setPlayerTombs(tombs) {
		world.setDynamicProperty(this.getPlayerTombsId(), JSON.stringify(tombs));
	}

	addTombToPlayerList(id, maxTombs) {
		const tombs = this.getPlayerTombs();

		tombs.push(id);

		if (maxTombs > 0) {
			while (tombs.length > maxTombs) {
				const oldId = tombs.shift();
				TombRegistry.deleteTombById(oldId);
			}
		}

		this.setPlayerTombs(tombs);
	}
	static deleteTombById(id) {
		const raw = world.getDynamicProperty(id);
		if (!raw) return;

		const tomb = JSON.parse(raw);

		if (tomb.structureId) {
			world.structureManager.delete(tomb.structureId);
		}

		const [dimName, rawLocation] = id.split(":");
		const [x, y, z] = rawLocation.split("|").map(Number);

		const dimension = world.getDimension(dimName);
		dimension.runCommand(`setblock ${x} ${y} ${z} air replace`);

		world.setDynamicProperty(id, undefined);
	}
}
