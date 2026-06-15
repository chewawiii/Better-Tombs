import { system, world } from "@minecraft/server";
import { MEMBER_CONFIG, OPERATOR_CONFIG, CONFIG_PREFIX } from "./config.js";
import "./death.js";
import "./recover.js";
import "./ui.js";
import { TombRegistry } from "./registry.js";

world.afterEvents.worldLoad.subscribe(() => {
	const raw = world.getDynamicProperty(CONFIG_PREFIX);
	if (!raw) {
		world.setDynamicProperty(CONFIG_PREFIX, JSON.stringify(OPERATOR_CONFIG));
		return;
	}

	const saved = JSON.parse(raw);
	const update = mergeConfig(OPERATOR_CONFIG, saved);
	world.setDynamicProperty(CONFIG_PREFIX, JSON.stringify(update));
});

world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
	if (!initialSpawn) return;
	player.sendMessage(translate("spawn.message"));

	const raw = player.getDynamicProperty(CONFIG_PREFIX);
	if (!raw) {
		player.setDynamicProperty(CONFIG_PREFIX, JSON.stringify(MEMBER_CONFIG));
		return;
	}

	const saved = JSON.parse(raw);
	const update = mergeConfig(MEMBER_CONFIG, saved);
	player.setDynamicProperty(CONFIG_PREFIX, JSON.stringify(update));
});

function mergeConfig(config, saved) {
	const mergedConfig = { ...config };
	for (const key of Object.keys(config)) {
		if (saved[key] !== undefined) {
			mergedConfig[key] = saved[key];
		}
	}
	return mergedConfig;
}

const teleportConfirm = new Map();

world.beforeEvents.itemUse.subscribe(({ itemStack, source: player }) => {
	if (!itemStack?.nameTag?.includes("Teleport Item")) return;

	const memberConfig = TombRegistry.getMemberConfig(player);
	const allowEffects = memberConfig.showEffects;

	const itemKey = `${player.name}:${itemStack.nameTag}`;

	if (memberConfig.confirmTeleport && teleportConfirm.get(player.name) !== itemKey) {
		teleportConfirm.set(player.name, itemKey);
		player.sendMessage(translate("confirm.teleport.message"));

		system.runTimeout(() => {
			if (teleportConfirm.get(player.name) === itemKey) {
				teleportConfirm.delete(player.name);
			}
		}, 20 * 5);

		return;
	}

	teleportConfirm.delete(player.name);

	const [dimName, location] = itemStack.nameTag.split("\n")[1].split(":");
	const [sx, sy, sz] = location.split(",").map(Number);

	system.run(() => {
		if (allowEffects) player.addEffect("blindness", 20 * 3, { showParticles: false });

		system.runTimeout(() => {
			player.teleport(
				{ x: sx + 0.5, y: sy + 1, z: sz + 0.5 },
				{ dimension: world.getDimension(dimName) },
			);

			if (allowEffects) player.playSound("mob.endermen.portal", { pitch: 0.8, volume: 1 });

			const inventory = player.getComponent("inventory").container;
			inventory.setItem(player.selectedSlotIndex, undefined);
		}, 20 * 2);
	});
});

export function translate(text, args = []) {
	if (!args.length) return { rawtext: [{ translate: text }] };
	return { rawtext: [{ translate: text, with: [...args] }] };
}
