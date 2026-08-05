import { system, world } from "@minecraft/server";
import { TombManager } from "./TombManager.js";
import { translate } from "./TombIndex.js";

/** @type {import("@minecraft/server").ItemCustomComponent} */
const soulPearl = {
	onUse({ itemStack, source: player }) {
		if (itemStack.nameTag === undefined) return;
		const memberConfig = TombManager.getPlayerConfig(player);

		const [dimName, location] = itemStack.nameTag.split("\n")[1].split(":");
		const [sx, sy, sz] = location.split(",").map(Number);

		const dimension = world.getDimension(dimName);
		const isTombstone = dimension.getBlock({ x: sx, y: sy, z: sz }).typeId.includes("tombstone");

		const inventory = player.getComponent("inventory").container;

		if (!isTombstone) {
			system.run(() => {
				inventory.setItem(player.selectedSlotIndex, undefined);
				player.sendMessage(translate("message.cantTeleport"));
			});
			return;
		}
		system.run(() => {
			player.sendMessage(translate("message.teleporting"));
			player.addEffect("blindness", 20 * 3, { showParticles: false });

			system.runTimeout(() => {
				player.teleport({ x: sx + 0.5, y: sy + 1, z: sz + 0.5 }, { dimension: dimension });

				player.playSound("mob.endermen.portal", { pitch: 0.8, volume: 1 });
				inventory.setItem(player.selectedSlotIndex, undefined);
			}, 20 * 2);
		});
	},
};
system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
	itemComponentRegistry.registerCustomComponent("et:soul_pearl", soulPearl);
});

system.runInterval(() => {
	for (const player of world.getPlayers()) {
		const config = TombManager.getPlayerConfig(player);
		if (!config.showHud) continue;

		const tombIds = TombManager.getTombIds(player);
		if (tombIds.length === 0) continue;

		// Tumba más reciente
		const latestTombId = tombIds[tombIds.length - 1];
		const raw = world.getDynamicProperty(latestTombId);
		if (!raw) continue;

		const tomb = JSON.parse(raw);

		// Distancia
		const [dimName, coords] = latestTombId.split(":");
		const [x, y, z] = coords.split("_").map(Number);
		const tombDim = player.dimension.id.split(":")[1];
		const remainingTicks = tomb.protectEnd - system.currentTick;

		const distanceText = `${Math.floor(
			Math.sqrt(
				(player.location.x - x) ** 2 + (player.location.y - y) ** 2 + (player.location.z - z) ** 2,
			),
		)}`;
		const protectionText = `${Math.ceil(remainingTicks / 20 / 60)}`;

		let lang, args;

		if (dimName !== tombDim && remainingTicks <= 0) {
			lang = "hud.unprotected.otherDim";
			args = [];
		} else if (dimName !== tombDim) {
			lang = "hud.otherDim";
			args = [protectionText];
		} else if (remainingTicks <= 0) {
			lang = "hud.unprotected";
			args = [distanceText];
		} else {
			lang = "hud.distance";
			args = [distanceText, protectionText];
		}

		player.onScreenDisplay.setActionBar(translate(lang, args));
	}
}, 10);
