import { EquipmentSlot, PlayerPermissionLevel, system, world } from "@minecraft/server";
import { TombManager } from "./TombManager.js";
import { CURSE_LEVELS } from "./TombConfig.js";
import { translate } from "./TombIndex.js";

const lockPlayer = new Set();

world.beforeEvents.playerBreakBlock.subscribe(recoveryEvent);
world.beforeEvents.playerInteractWithBlock.subscribe(recoveryEvent);

/**
 *
 * @param {import("@minecraft/server").PlayerBreakBlockAfterEvent} event
 * @returns
 */
function recoveryEvent(event) {
	const { player, block } = event;
	if (!block.typeId.includes("tombstone")) return;

	const hasItems = block.permutation.getState("tombs:hasItems");
	if (!hasItems) return;

	const manager = new TombManager(player, block.location);
	const tomb = manager.fetchTomb;
	if (!tomb) return;

	if (lockPlayer.has(player.name)) return;
	lockPlayer.add(player.name);

	const config = TombManager.getSystemConfig();
	const isOperator = player.playerPermissionLevel === PlayerPermissionLevel.Operator;
	const canBypassProtection = config.operatorBypassProtection && isOperator;
	const isOwner = tomb.ownerName === player.name;
	const isProtected = config.activateProtection && tomb.protectEnd >= system.currentTick;

	if (isProtected && !isOwner && !canBypassProtection) {
		event.cancel = true;
		const totalSeconds = Math.max(Math.floor((tomb.protectEnd - system.currentTick) / 20), 0);
		const minutes = Math.floor(totalSeconds / 60);

		applyIntruderCurse(player, block.location, config);
		player.sendMessage(translate("message.tomb.protected", [`${minutes}`]));
		return releasePlayer(player, 5);
	}

	if (config.activateIntruderCurse && !isOwner) applyIntruderCurse(player, block.location, config);

	system.run(() => {
		if (tomb.structureId) {
			recoverInventory(block, tomb.structureId);
			const entities = block.dimension.getEntities({
				location: block.location,
				maxDistance: 2,
				excludeTypes: ["minecraft:item", "minecraft:player"],
			});
			for (const entity of entities) {
				entity.remove();
			}
			const itemEntities = block.dimension.getEntities({
				location: block.location,
				maxDistance: 2,
				type: "minecraft:item",
			});
			for (const entity of itemEntities) {
				const newItem = removeLore(entity, tomb.ownerName);
				newItem.teleport(player.location);
			}
		}
		recoverXp(player, tomb.savedXp);
		soulRecoverEffect(player.dimension, block.location);
		TombManager.deleteTomb(manager.tombId);
		block.dimension.runCommand(
			`setblock ${block.location.x} ${block.location.y} ${block.location.z} air replace`,
		);
		releasePlayer(player);
	});
}

function releasePlayer(player, sec = 1) {
	system.runTimeout(() => {
		lockPlayer.delete(player.name);
	}, 20 * sec);
}

function recoverInventory(block, structureId) {
	const { dimension, location } = block;
	world.structureManager.place(structureId, dimension, { ...location, y: location.y + 0.25 });
	world.structureManager.delete(structureId);
}

function recoverXp(player, xp) {
	player.addExperience(xp);
}

function applyIntruderCurse(player, location, config) {
	if (!config.activateIntruderCurse) return;
	const curseLevel = Math.max(CURSE_LEVELS.indexOf(config.intruderCurseLevel), 0) + 1;
	const curseEntityType = config.intruderCurseEntityType;
	const curseEffectType = config.intruderCurseEffectType;
	const durationTicks = 20 * (4 + curseLevel * 4);
	const amplifier = Math.min(curseLevel - 1, 2);
	let mobCount = curseLevel * 2 - 1;
	const spawnDelay = Math.max(30 - curseLevel * 5, 10);

	system.run(() => {
		player.addEffect(curseEffectType, durationTicks, { amplifier: amplifier });
		player.sendMessage(translate("message.tomb.cursed"));
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

/**
 *
 * @param {import("@minecraft/server").Entity} itemEntity
 * @param {*} playerName
 */
function removeLore(itemEntity, ownerName) {
	const itemComponent = itemEntity.getComponent("item");
	if (!itemComponent) return;

	const itemStack = itemComponent.itemStack;
	const newLore = itemStack.getLore().filter((lore) => !lore.includes(ownerName));
	itemStack.setLore(newLore);

	const location = itemEntity.location;
	const dimension = itemEntity.dimension;

	itemEntity.remove();
	return dimension.spawnItem(itemStack, location);
}

function soulRecoverEffect(dimension, location) {
	for (let i = 0; i < 50; i++) {
		const spread = 2.5;
		const x = location.x + (Math.random() - 0.5) * spread;
		const y = location.y + Math.random() * 2;
		const z = location.z + (Math.random() - 0.5) * spread;
		dimension.spawnParticle("minecraft:soul_particle", { x, y, z });
	}

	dimension.playSound("respawn_anchor.set_spawn", location, { volume: 1.5, pitch: 0.8 });
	system.runTimeout(() => {
		dimension.playSound("mob.endermen.portal", location, { volume: 1, pitch: 1.2 });
	}, 20);
}
