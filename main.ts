import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
// import { Client } from "@notionhq/client";

import {config} from "dotenv";

config();
// Remember to rename these classes and interfaces!

interface NotionDatabase {
		id: string;
		link: string;
}
interface MyPluginSettings {
	notionToken: string;
	database: NotionDatabase
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	notionToken: process.env.NOTION_TOKEN || '',
	database: {
		link:  process.env.NOTION_DATABASE_LINK || '',
		id: ''
	}
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Notion Integration Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Loading Databases');
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new NotionDatabases(this.app).open();
			}
		});
		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new NotionDatabases(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new NotionDatabases(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin')
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class NotionDatabases extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.innerHTML = `

		`;
		// contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my Notion Sync.'});
		new Setting(containerEl)
			.setName('Notion Token')
			.setDesc('Can be obtained via https://www.notion.so/my-integrations (Secrets/Internal Integration Token)')
			.addText(text => text
				.setPlaceholder('Enter the API Token')
				.setValue(this.plugin.settings.notionToken)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.notionToken = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Notion Database Link')
			.setDesc('The Database of notion that should be loaded')
			.addText(text => text
				.setPlaceholder('Enter the Link (https://www.notion.so/djdiox/a498e39378724d81ab6c045eb55c2a7d?v=97b06be2c3bb44f1aaefd549e3f244a7)')
				.setValue(this.plugin.settings.database.link)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.database.link = value;
					await this.plugin.saveSettings();
				}));
	}
}
