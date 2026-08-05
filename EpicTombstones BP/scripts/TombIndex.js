import { system, world } from "@minecraft/server";
import "./TombCreation.js";
import "./TombRecovery.js";
import "./TombUI.js";
import "./TombUtils.js";

world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
	if (!initialSpawn) return;
	player.sendMessage(translate("message.initialSpawn"));
});

export function translate(text, args = []) {
	if (!args.length) return { rawtext: [{ translate: text }] };
	return { rawtext: [{ translate: text, with: args }] };
}
