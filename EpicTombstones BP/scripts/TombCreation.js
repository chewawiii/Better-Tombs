import {
	BlockVolume,
	EnchantmentTypes,
	EquipmentSlot,
	ItemStack,
	Player,
	StructureSaveMode,
	system,
	world,
} from "@minecraft/server";
import { TombManager } from "./TombManager.js";
import { ITEM_RATE, TOMBS } from "./TombConfig.js";
import { translate } from "./TombIndex.js";

/**
 * Primero hace un check de si el jugador tiene el totem
 * Si no lo tiene y morira, se le pondra su nick en todos sus items
 */
const playerCheck = new Set();
world.beforeEvents.entityHurt.subscribe((e) => {
	const { hurtEntity: player, damage, damageSource } = e;
	if (!(player instanceof Player)) return;

	const health = player.getComponent("health").currentValue;
	if (hasTotem(player) || health - damage >= 0) return;

	if (playerCheck.has(player.name)) return;
	playerCheck.add(player.name);
	e.cancel = true;

	const damagingEntity = damageSource.damagingEntity;

	system.run(() => {
		const inventory = player.getComponent("inventory").container;
		for (let i = 0; i < inventory.size; i++) {
			const item = inventory.getItem(i);
			if (!item) continue;
			inventory.setItem(i, addLore(item, player.name));
		}

		const equippable = player.getComponent("equippable");
		const armorSlots = [
			EquipmentSlot.Chest,
			EquipmentSlot.Feet,
			EquipmentSlot.Head,
			EquipmentSlot.Legs,
			EquipmentSlot.Offhand,
		];
		for (const slot of armorSlots) {
			const item = equippable.getEquipment(slot);
			if (!item) continue;
			equippable.setEquipment(slot, addLore(item, player.name));
		}

		const cause = damageSource.cause === "projectile" ? "entityAttack" : damageSource.cause;

		player.applyDamage(damage, {
			cause: cause,
			damagingEntity: damagingEntity?.isValid ? damagingEntity : undefined,
		});

		playerCheck.delete(player.name);
	});
});

/**
 * Cuando el jugador muere, se creara su tumba
 */
world.afterEvents.entityDie.subscribe(({ deadEntity: player, damageSource }) => {
	if (!(player instanceof Player)) return;

	const dimension = player.dimension;
	let location = player.location;

	system.run(() => {
		const itemEntities = dimension.getEntities({
			location: location,
			maxDistance: 5,
			type: "minecraft:item",
		});
		if (itemEntities.length === 0 && player.getTotalXp() <= 0) return;

		location = getValidLocation(dimension, location);

		const manager = new TombManager(player, location);
		const hasItems = createStructure(manager, dimension, location, itemEntities, damageSource.cause);
		removeXpOrbs(dimension, location);

		const playerConfig = TombManager.getPlayerConfig(player);
		const itemChanceRate = Math.max(ITEM_RATE.indexOf(playerConfig.itemChanceRate), 0);

		if (itemChanceRate > 0) {
			const LEVEL_THRESHOLD = [null, 60, 50, 40];
			const COST_PERCENT = [null, 0.25, 0.5, 0.9];

			const chance = Math.min((player.level / LEVEL_THRESHOLD[itemChanceRate]) * 100, 100);
			if (Math.random() * 100 < chance) {
				const cost = Math.floor(player.level * COST_PERCENT[itemChanceRate]);
				player.addLevels(-cost);
				giveItem(player, location);
			}
		}

		manager.registerTomb(hasItems);
		placeTombstone(dimension, location, damageSource.cause);

		const coords = `${location.x}, ${location.y}, ${location.z}`;
		const dimName = `${dimension.id.split(":")[1]}`;
		player.sendMessage(translate("message.player.death", [coords, dimName]));

		const systemConfig = TombManager.getSystemConfig();
		if (!systemConfig.announceDeath) return;
		world.sendMessage(translate("message.system.death", [coords, dimName]));
	});
});

/**
 * Revisa si el jugador tiene el totem
 */
function hasTotem(player) {
	const equippable = player.getComponent("equippable");
	const mainHand = equippable.getEquipment(EquipmentSlot.Mainhand);
	const offHand = equippable.getEquipment(EquipmentSlot.Offhand);
	return (
		mainHand?.typeId === "minecraft:totem_of_undying" ||
		offHand?.typeId === "minecraft:totem_of_undying"
	);
}

/**
 * Agrega el nick del jugador en el lore
 */
function addLore(item, playerName) {
	const lore = item.getLore();
	lore.push(`${playerName}`);
	item.setLore(lore);
	return item;
}

/**
 * Crea la estructura si hay items
 * @param {TombManager} manager
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Location} location
 * @param {import("@minecraft/server").Entity[]} itemEntities
 * @returns
 */
function createStructure(manager, dimension, location, itemEntities, cause) {
	if (itemEntities.length === 0) return false;

	const playerItems = [];
	const safeLocation = { ...location, y: location.y + 5 };

	for (const entity of itemEntities) {
		const itemComponent = entity.getComponent("item");
		const item = itemComponent.itemStack;
		const lore = item.getLore();
		if (cause === "void" && dimension.id.split(":")[1] === "the_end") {
			entity.teleport(safeLocation);
			playerItems.push(entity);
		} else {
			if (!lore.some((line) => line.includes(manager.player.name))) continue;
			entity.teleport(safeLocation);
			playerItems.push(entity);
		}
	}
	const from = { x: safeLocation.x - 0.5, y: safeLocation.y - 0.5, z: safeLocation.z - 0.5 };
	const to = { x: safeLocation.x + 0.5, y: safeLocation.y + 0.5, z: safeLocation.z + 0.5 };
	world.structureManager.createFromWorld(manager.tombId, dimension, from, to, {
		saveMode: StructureSaveMode.World,
		includeEntities: true,
		includeBlocks: false,
	});

	for (const entity of playerItems) {
		entity.remove();
	}
	return true;
}

/**
 * Elimina los orbes de experiencia
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Location} location
 */
function removeXpOrbs(dimension, location) {
	system.runTimeout(() => {
		const xpEntities = dimension.getEntities({
			location: location,
			maxDistance: 3,
			type: "minecraft:xp_orb",
		});

		for (const entity of xpEntities) {
			entity.remove();
		}
	}, 21);
}

/**
 * Busca una ubicación válida para la tumba
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Location} location
 * @returns {{ x: number, y: number, z: number }}
 */
function getValidLocation(dimension, location) {
	const baseY = dimension.id.includes("overworld")
		? location.y < -64
			? -60
			: location.y
		: location.y < 0
			? 5
			: location.y;
	const block = dimension.getBlock({ x: location.x, y: baseY, z: location.z });

	const blocks = [block, block.north(), block.south(), block.east(), block.west()];
	for (const b of blocks) {
		if (!b.typeId.includes("tombstone") && !b.typeId.includes("bedrock")) return b.location;
	}
	return location;
}

/**
 * Coloca la tumba en el mundo
 * @param {import("@minecraft/server").Dimension} dimension
 * @param {import("@minecraft/server").Location} location
 */
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
	block.setPermutation(block.permutation.withState("tombs:hasItems", true));

	soulCircleEffect(dimension, location);
	dimension.playSound("mob.wither.death", location, { volume: 2, pitch: 1.2 });
}

/**
 * Da el item al jugador
 * @param {import("@minecraft/server").Player} player
 * @param {import("@minecraft/server").Location} location
 */
function giveItem(player, location) {
	const dimName = player.dimension.id.split(":")[1];
	const color = dimName === "overworld" ? "§a" : dimName === "nether" ? "§c" : "§d";

	const itemStack = new ItemStack("et:soul_pearl", 1);
	itemStack.nameTag = `${color}${player.name}'s Teleport Item§7\n${dimName}: ${location.x}, ${location.y}, ${location.z}`;

	const inventory = player.getComponent("inventory").container;
	for (let i = 0; i < inventory.size; i++) {
		if (!inventory.getItem(i)) {
			inventory.setItem(i, itemStack);
			break;
		}
	}
}

function soulCircleEffect(dimension, location) {
	const radius = 1.5;
	const points = 16;

	for (let i = 0; i < points; i++) {
		const angle = (i / points) * 2 * Math.PI;
		const x = location.x + radius * Math.cos(angle);
		const z = location.z + radius * Math.sin(angle);
		dimension.spawnParticle("minecraft:soul_particle", { x, y: location.y + 0.5, z });
	}
}
