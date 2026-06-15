import { CommandPermissionLevel, PlayerPermissionLevel, system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { TombRegistry } from "./registry.js";
import { CONFIG_PREFIX, CURSE_EFFECTS, CURSE_ENTITIES, CURSE_LEVELS, ITEM_RATE } from "./config.js";
import { translate } from "./main.js";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
	customCommandRegistry.registerCommand(
		{
			name: "tombs:settings",
			description: "Open better tombs settings menu",
			permissionLevel: CommandPermissionLevel.Any,
			cheatsRequired: false,
		},
		(origin) => {
			if (!origin.sourceEntity) return;
			openInfoMenu(origin.sourceEntity);
		},
	);
});

function isOperator(player) {
	if (player.playerPermissionLevel === PlayerPermissionLevel.Operator) return true;
	return false;
}

function openInfoMenu(player) {
	const buttons = [];
	system.run(() => {
		const form = new ActionFormData();

		form.title(translate("ui.info.title"));

		if (isOperator(player)) {
			form.button(translate("ui.system.settings.button"));
			buttons.push("systemSettings");
		}

		form.button(translate("ui.settings.button"));
		buttons.push("settings");

		form.button(translate("ui.changelog.button"));
		buttons.push("changelog");

		form.button(translate("ui.close.button"));
		buttons.push("close");

		form.show(player).then((res) => {
			if (res.canceled) return;
			const action = buttons[res.selection];
			switch (action) {
				case "systemSettings":
					systemSettingsMenu(player);
					break;

				case "settings":
					settingsMenu(player);
					break;

				case "changelog":
					changelogMenu(player);
					break;

				case "close":
					break;
			}
		});
	});
}

function systemSettingsMenu(player) {
	const config = TombRegistry.getOperatorConfig();
	const form = new ModalFormData();

	form.title(translate("ui.system.settings.title"));

	form.toggle(translate("ui.announce.death.toggle"), {
		defaultValue: config.announceDeath,
		tooltip: translate("ui.announce.death.tooltip"),
	});

	form.slider(translate("ui.max.tombs.slider"), 0, 8, {
		defaultValue: config.maxTombsPerPlayer,
		tooltip: translate("ui.max.tombs.tooltip"),
	});

	form.slider(translate("ui.protection.duration.slider"), 0, 15, {
		defaultValue: config.protectionDuration,
		valueStep: 3,
		tooltip: translate("ui.protection.duration.tooltip"),
	});

	form.dropdown(
		translate("ui.curse.level.dropdown"),
		CURSE_LEVELS.map((level) => translate(`ui.curse.level.${level}`)),
		{
			defaultValueIndex: Math.max(CURSE_LEVELS.indexOf(config.intruderCurseLevel), 0),
		},
	);

	form.dropdown(
		translate("ui.curse.entity.dropdown"),
		CURSE_ENTITIES.map((entity) => translate(`ui.entity.${entity}`)),
		{
			defaultValueIndex: Math.max(CURSE_ENTITIES.indexOf(config.intruderCurseEntityType), 0),
		},
	);

	form.dropdown(
		translate("ui.curse.effect.dropdown"),
		CURSE_EFFECTS.map((effect) => translate(`ui.effect.${effect}`)),
		{
			defaultValueIndex: Math.max(CURSE_EFFECTS.indexOf(config.intruderCurseEffectType), 0),
		},
	);

	form.toggle(translate("ui.bypass.protection.toggle"), {
		defaultValue: config.operatorBypassProtection,
	});

	form.show(player).then((res) => {
		if (res.canceled) return;
		const [
			announceDeath,
			maxTombsPerPlayer,
			protectionDuration,
			curseLevelIndex,
			curseEntityIndex,
			curseEffectIndex,
			operatorBypassProtection,
		] = res.formValues;

		const newConfig = {
			...config,
			announceDeath,
			maxTombsPerPlayer,
			protectionDuration,
			intruderCurseLevel: CURSE_LEVELS[curseLevelIndex],
			intruderCurseEntityType: CURSE_ENTITIES[curseEntityIndex],
			intruderCurseEffectType: CURSE_EFFECTS[curseEffectIndex],
			operatorBypassProtection,
		};

		world.setDynamicProperty(CONFIG_PREFIX, JSON.stringify(newConfig));

		player.sendMessage({ rawtext: [{ translate: "ui.system.settings.saved" }] });
	});
}

function settingsMenu(player) {
	const config = TombRegistry.getMemberConfig(player);
	const form = new ModalFormData();

	form.title(translate("ui.settings.title"));

	form.dropdown(
		translate("ui.item.chance.dropdown"),
		ITEM_RATE.map((chance) => translate(`ui.item.chance.${chance}`)),
		{
			defaultValueIndex: Math.max(ITEM_RATE.indexOf(config.itemChanceRate), 0),
		},
	);

	form.toggle(translate("ui.confirm.teleport.toggle"), {
		defaultValue: config.confirmTeleport,
		tooltip: translate("ui.confirm.teleport.tooltip"),
	});

	form.toggle(translate("ui.teleport.effects.toggle"), {
		defaultValue: config.showEffects,
	});

	/*form.toggle(translate("ui.show.distance.toggle"), {
		defaultValue: config.showTombDistance,
	});

	form.toggle(translate("ui.show.coordinates.toggle"), {
		defaultValue: config.showTombCoordinates,
	});

	form.toggle(translate("ui.show.protection.toggle"), {
		defaultValue: config.showTombProtectionTime,
	});*/

	form.show(player).then((res) => {
		if (res.canceled) return;
		const [
			itemChanceRate,
			confirmTeleport,
			showEffects,
			/*showTombDistance,
			showTombCoordinates,
			showTombProtectionTime,*/
		] = res.formValues;

		const newConfig = {
			...config,
			itemChanceRate: ITEM_RATE[itemChanceRate],
			confirmTeleport,
			showEffects,
			/*showTombDistance,
			showTombCoordinates,
			showTombProtectionTime,*/
		};

		player.setDynamicProperty(CONFIG_PREFIX, JSON.stringify(newConfig));
		player.sendMessage({ rawtext: [{ translate: "ui.settings.saved" }] });
	});
}

function changelogMenu(player) {
	const form = new ActionFormData();
	form.title(translate("ui.changelog.title"));
	form.body(translate("ui.changelog.body"));
	form.button(translate("ui.close.button"));
	form.show(player).then((res) => {
		if (res.canceled) return;
	});
}
