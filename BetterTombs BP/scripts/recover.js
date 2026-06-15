import { PlayerPermissionLevel, system, world } from "@minecraft/server";
import { TombRegistry } from "./registry.js";
import { CURSE_LEVELS } from "./config.js";
import { translate } from "./main.js";

world.beforeEvents.playerBreakBlock.subscribe(recoverEvent);
world.beforeEvents.playerInteractWithBlock.subscribe(recoverEvent);

const lockPlayer = new Set();

function recoverEvent(event) {
	const { player, block } = event;
	if (!block.typeId.includes("tombstone")) return;

	const hasItems = block.permutation.getState("tombs:hasItems");
	if (!hasItems) return;

	const registry = new TombRegistry(player, block.location);
	const tomb = registry.fetchTomb();
	if (!tomb) return;

	if (lockPlayer.has(player.name)) return;
	lockPlayer.add(player.name);

	const config = TombRegistry.getOperatorConfig();

	const isOperator = player.playerPermissionLevel === PlayerPermissionLevel.Operator;
	const canBypassProtection = config.operatorBypassProtection && isOperator;
	const isOwner = tomb.ownerName === player.name;
	const isProtected = tomb.protectEnd >= system.currentTick;
	if (isProtected && !isOwner && !canBypassProtection) {
		event.cancel = true;
		const totalSeconds = Math.max(Math.floor((tomb.protectEnd - system.currentTick) / 20), 0);
		const minutes = Math.min(Math.floor(totalSeconds / 60), 60);

		applyIntruderCurse(player, block.location, config);
		player.sendMessage(translate("tomb.protected.message", [`${minutes}`]));
		return releasePlayer(player, 5);
	}

	system.run(() => {
		if (tomb.structureId) {
			recoverInventory(block, tomb.structureId);
			block.dimension.getEntitiesAtBlockLocation(block.location).forEach((entity) => {
				if (entity.typeId !== "minecraft:item") entity.remove();
			});
		}
		recoverXp(player, tomb.savedXp);
		effectsTomb(block, player);
		releasePlayer(player);
		registry.deleteTomb();
	});
}

function releasePlayer(player, sec = 1) {
	system.runTimeout(() => {
		lockPlayer.delete(player.name);
	}, 20 * sec);
}

function recoverInventory(block, structureId) {
	const { dimension, location } = block;
	world.structureManager.place(structureId, dimension, location);
	world.structureManager.delete(structureId);
}

function recoverXp(player, xp) {
	player.addExperience(xp);
}

function effectsTomb(block, player) {
	const { dimension, location } = block;
	const allowEffects = TombRegistry.getMemberConfig(player).showEffects;
	if (allowEffects) {
		dimension.spawnParticle("minecraft:totem_particle", location);
		dimension.playSound("respawn_anchor.deplete", location, { pitch: 1.5 });
	}
	dimension.runCommand(`setblock ${location.x} ${location.y} ${location.z} air replace`);
}

function applyIntruderCurse(player, location, config) {
	const curseLevel = Math.max(CURSE_LEVELS.indexOf(config.intruderCurseLevel), 0);
	if (curseLevel <= 0) return;
	const curseEntityType = config.intruderCurseEntityType;
	const curseEffectType = config.intruderCurseEffectType;

	const durationTicks = 20 * (4 + curseLevel * 4);
	const amplifier = Math.min(curseLevel - 1, 2);
	let mobCount = curseLevel * 2 - 1;
	const spawnDelay = Math.max(30 - curseLevel * 5, 10);

	system.run(() => {
		player.addEffect(curseEffectType, durationTicks, { amplifier: amplifier });

		const intervalId = system.runInterval(() => {
			if (mobCount <= 0) {
				system.clearRun(intervalId);
				return;
			}

			player.dimension.spawnEntity(curseEntityType, location);
			mobCount--;
		}, spawnDelay);
	});
}
