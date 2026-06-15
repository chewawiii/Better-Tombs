import {
	BlockVolume,
	EnchantmentTypes,
	ItemStack,
	Player,
	StructureSaveMode,
	system,
	world,
} from "@minecraft/server";
import { TombRegistry } from "./registry.js";
import { ITEM_RATE, TOMBS } from "./config.js";
import { translate } from "./main.js";

world.afterEvents.entityDie.subscribe(({ deadEntity: player, damageSource }) => {
	if (!(player instanceof Player)) return;
	system.run(() => {
		const dimension = player.dimension;
		let location = {
			x: player.getHeadLocation().x,
			y: player.getHeadLocation().y - 1,
			z: player.getHeadLocation().z,
		};
		const itemEntities = dimension.getEntities({
			location: location,
			maxDistance: 2.5,
			type: "minecraft:item",
		});
		if (itemEntities.length === 0 && player.getTotalXp() <= 0) return;

		location = getValidLocation(dimension, location);
		const registry = new TombRegistry(player, location);
		let hasItems = false;

		// Check if the player had items and save them
		if (itemEntities.length > 0) {
			hasItems = true;
			itemEntities.forEach((entity) => {
				entity.teleport(location);
			});

			removeMonsters(dimension, location);

			const tombId = registry.makeTombId();
			world.structureManager.createFromWorld(tombId, dimension, location, location, {
				saveMode: StructureSaveMode.World,
				includeEntities: true,
				includeBlocks: false,
			});
			itemEntities.forEach((entity) => {
				entity.remove();
			});
		}

		// Remove any xp orbs
		system.runTimeout(() => {
			const xpEntities = dimension.getEntities({
				location: location,
				maxDistance: 5,
				type: "minecraft:xp_orb",
			});
			if (xpEntities.length === 0) return;
			xpEntities.forEach((entity) => {
				entity.remove();
			});
		}, 20);

		const memberConfig = TombRegistry.getMemberConfig(player);
		const itemChanceRate = Math.max(ITEM_RATE.indexOf(memberConfig.itemChanceRate), 0);
		const chance = Math.min(itemChanceRate * player.level, 100);
		if (Math.random() * 100 < chance) {
			player.addLevels(-Math.floor(chance / 3));
			giveItem(player, location);
		}

		registry.registerTomb(hasItems);
		placeTombstone(dimension, location, damageSource.cause);
		const args = [
			`${location.x}, ${location.y}, ${location.z}`,
			`${player.dimension.id.split(":")[1]}`,
		];
		player.sendMessage(translate("death.message", args));
		const config = TombRegistry.getOperatorConfig();
		if (!config.announceDeath) return;
		world.sendMessage(translate("announce.death.message", args));
	});
});

/**
 *
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {*} location
 * @returns
 */
function getValidLocation(dimension, location) {
	/**
	 * @type {import("@minecraft/server").Block}
	 */
	const baseY = dimension.id.includes("overworld")
		? location.y < -64
			? -60
			: location.y
		: location.y < 0
			? 5
			: location.y;
	const block = dimension.getBlock({ x: location.x + 0.5, y: baseY, z: location.z + 0.5 });

	const blocks = [block, block.north(), block.south(), block.east(), block.west()];
	for (const b of blocks) {
		if (!b.typeId.includes("tombstone")) return b.location;
	}
}

function removeMonsters(dimension, location) {
	const entities = dimension.getEntities({
		location: location,
		maxDistance: 1.5,
		families: ["monster"],
	});
	if (entities.length === 0) return;
	entities.forEach((entity) => entity.remove());
}

function placeTombstone(dimension, location, cause) {
	const dimName = dimension.id.split(":")[1];
	if (dimName === "the_end" && cause === "void") {
		const volume = new BlockVolume(
			{ x: location.x - 1, y: location.y - 1, z: location.z - 1 },
			{ x: location.x + 1, y: location.y - 1, z: location.z + 1 },
		);
		dimension.fillBlocks(volume, "minecraft:end_stone");
	}

	const randomBlock = TOMBS[Math.floor(Math.random() * TOMBS.length)];
	const block = dimension.getBlock(location);
	block.setType(randomBlock);

	const permutation = block.permutation.withState("tombs:hasItems", true);
	block.setPermutation(permutation);

	dimension.playSound("respawn_anchor.charge", location, { volume: 2, pitch: 1.5 });
}

function giveItem(player, location) {
	const dimName = player.dimension.id.split(":")[1];
	const color = dimName === "overworld" ? "§a" : dimName === "nether" ? "§c" : "§d";

	const itemStack = new ItemStack("minecraft:recovery_compass", 1);
	itemStack.nameTag = `${color}${player.name}'s Teleport Item§7\n${dimName}: ${location.x}, ${location.y}, ${location.z}`;
	itemStack.getComponent("enchantable").addEnchantment({
		type: EnchantmentTypes.get("vanishing"),
		level: 1,
	});

	const inventory = player.getComponent("inventory").container;
	for (let i = 0; i < inventory.size; i++) {
		if (!inventory.getItem(i)) {
			inventory.setItem(i, itemStack);
			break;
		}
	}
}
