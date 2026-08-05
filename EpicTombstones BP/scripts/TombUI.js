import { CommandPermissionLevel, Player, PlayerPermissionLevel, system, world } from "@minecraft/server";
import { CustomForm, ObservableBoolean, ObservableNumber } from "@minecraft/server-ui";
import { TombManager } from "./TombManager.js";
import {
	PREFIX,
	CURSE_EFFECTS_TYPES,
	CURSE_ENTITIES_TYPES,
	CURSE_LEVELS,
	ITEM_RATE,
} from "./TombConfig.js";
import { translate } from "./TombIndex.js";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
	customCommandRegistry.registerCommand(
		{
			name: "ets:settings",
			description: "Open epic tombstones settings menu",
			permissionLevel: CommandPermissionLevel.Any,
			cheatsRequired: false,
		},
		(origin) => {
			if (!origin.sourceEntity) return;
			system.run(() => tombsForm(origin.sourceEntity));
		},
	);
});

function booleanValue(value) {
	return new ObservableBoolean(value, { clientWritable: true });
}
function numberValue(value) {
	return new ObservableNumber(value, { clientWritable: true });
}
function dropdownValue(values, currentValue, translatePrefix) {
	return {
		index: numberValue(values.indexOf(currentValue), { clientWritable: true }),
		options: values.map((value, index) => ({
			label: translate(`${translatePrefix}.${value}`),
			value: index,
		})),
	};
}
function isOperator(player) {
	return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
}

/** @param {Player} player */
function tombsForm(player) {
	const form = new CustomForm(player, translate("form.title"));
	const operator = isOperator(player);

	const sectionOptions = [];
	if (operator) sectionOptions.push({ label: translate("form.section.system"), value: 0 });
	sectionOptions.push({ label: translate("form.section.player"), value: operator ? 1 : 0 });
	sectionOptions.push({ label: translate("form.section.changelog"), value: operator ? 2 : 1 });

	const defaultSection = operator ? 2 : 1;
	const activeSection = numberValue(defaultSection);

	const systemOpen = booleanValue(false);
	const playerOpen = booleanValue(false);
	const changelogOpen = booleanValue(true);

	activeSection.subscribe((v) => {
		systemOpen.setData(operator && v === 0);
		playerOpen.setData(operator ? v === 1 : v === 0);
		changelogOpen.setData(operator ? v === 2 : v === 1);
	});

	form.dropdown(translate("form.section.dropdown"), activeSection, sectionOptions);
	form.spacer();

	const saves = [];

	if (operator) {
		const save = systemForm(player, form, systemOpen);
		saves.push(save);
	}

	saves.push(playerForm(player, form, playerOpen));
	changelogForm(form, changelogOpen);

	form.show().then(() => {
		for (const save of saves) save();
		player.sendMessage(translate("message.settings.saved"));
	});
}

/**
 * @param {Player} player
 * @param {CustomForm} form
 * @param {Boolean} open
 */
function systemForm(player, form, open) {
	const config = TombManager.getSystemConfig();
	const saves = [];

	(function generalSection() {
		const announceDeath = booleanValue(config.announceDeath);
		const maxTombs = numberValue(config.maxTombsPerPlayer);

		form.toggle(translate("form.annDeath.toggle"), announceDeath, { visible: open });
		form.slider(translate("form.maxTombs.slider"), maxTombs, 2, 10, {
			description: translate("form.maxTombs.tooltip"),
			visible: open,
		});

		saves.push(() => {
			config.announceDeath = announceDeath.getData();
			config.maxTombsPerPlayer = maxTombs.getData();
		});
	})();

	(function protectionSection() {
		const activateProte = booleanValue(config.activateProtection);
		const protectionVisible = booleanValue(config.activateProtection && open.getData());

		open.subscribe((v) => protectionVisible.setData(v && activateProte.getData()));
		activateProte.subscribe((v) => protectionVisible.setData(v && open.getData()));

		const protectionDuration = numberValue(config.protectionDuration);
		const bypassProtection = booleanValue(config.operatorBypassProtection);

		form.spacer({ visible: open });
		form.toggle(translate("form.protection.toggle"), activateProte, { visible: open });
		form.slider(translate("form.duration.slider"), protectionDuration, 5, 20, {
			description: translate("form.duration.tooltip"),
			visible: protectionVisible,
		});
		form.toggle(translate("form.bypass.toggle"), bypassProtection, {
			visible: protectionVisible,
		});

		saves.push(() => {
			config.activateProtection = activateProte.getData();
			config.protectionDuration = protectionDuration.getData();
			config.operatorBypassProtection = bypassProtection.getData();
		});
	})();

	(function curseSection() {
		const activateIntruderCurse = booleanValue(config.activateIntruderCurse);
		const curseVisible = booleanValue(config.activateIntruderCurse && open.getData());

		open.subscribe((v) => curseVisible.setData(v && activateIntruderCurse.getData()));
		activateIntruderCurse.subscribe((v) => curseVisible.setData(v && open.getData()));

		const curseLevel = dropdownValue(CURSE_LEVELS, config.intruderCurseLevel, "form.curseLevel");
		const curseEntities = dropdownValue(
			CURSE_ENTITIES_TYPES,
			config.intruderCurseEntityType,
			"form.entity",
		);
		const curseEffects = dropdownValue(
			CURSE_EFFECTS_TYPES,
			config.intruderCurseEffectType,
			"form.effect",
		);

		form.spacer({ visible: open });
		form.toggle(translate("form.curse.toggle"), activateIntruderCurse, { visible: open });
		form.dropdown(translate("form.curseLevel.dropdown"), curseLevel.index, curseLevel.options, {
			visible: curseVisible,
		});
		form.dropdown(translate("form.curseEntity.dropdown"), curseEntities.index, curseEntities.options, {
			visible: curseVisible,
		});
		form.dropdown(translate("form.curseEffect.dropdown"), curseEffects.index, curseEffects.options, {
			visible: curseVisible,
		});

		saves.push(() => {
			config.activateIntruderCurse = activateIntruderCurse.getData();
			config.intruderCurseLevel = CURSE_LEVELS[curseLevel.index.getData()];
			config.intruderCurseEntityType = CURSE_ENTITIES_TYPES[curseEntities.index.getData()];
			config.intruderCurseEffectType = CURSE_EFFECTS_TYPES[curseEffects.index.getData()];
		});
	})();

	return () => {
		for (const save of saves) save();
		world.setDynamicProperty(PREFIX, JSON.stringify(config));
	};
}

/**
 * @param {Player} player
 * @param {CustomForm} form
 * @param {Boolean} open
 */
function playerForm(player, form, open) {
	const config = TombManager.getPlayerConfig(player);

	const itemChance = dropdownValue(ITEM_RATE, config.itemChanceRate, "form.itemChance");
	const showHud = booleanValue(config.showHud);
	const showLocatorBar = booleanValue(config.showLocatorBar);

	form.dropdown(translate("form.itemChance.dropdown"), itemChance.index, itemChance.options, {
		visible: open,
	});
	form.toggle(translate("form.hud.toggle"), showHud, {
		visible: open,
	});
	form.toggle(translate("form.locatorbar.toggle"), showLocatorBar, {
		visible: open,
	});

	return () => {
		config.itemChanceRate = ITEM_RATE[itemChance.index.getData()];
		config.showHud = showHud.getData();
		config.showLocatorBar = showLocatorBar.getData();

		player.setDynamicProperty(PREFIX, JSON.stringify(config));
	};
}

function changelogForm(form, open) {
	form.label(translate("form.changelog.label"), { visible: open });
}
