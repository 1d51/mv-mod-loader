/*:
 * @author 1d51
 * @version 0.3
 * @plugindesc A simple mod loader for RPG Maker MV.
 */
 
const fs = require('fs');
const xdiff = require("./js/libs/xdiff");

var ModLoader = ModLoader || {};

ModLoader.Helpers = ModLoader.Helpers || {};
ModLoader.Params = ModLoader.Params || {};
ModLoader.Config = ModLoader.Config || {};
ModLoader.Holder = ModLoader.Holder || {};

(function($) {
	$.Config.reduceModData = true; // Set to false if all mods are already reduced, to slightly increase performance.
	$.Config.forceBackup = false; // Set to true to rebuild file backups. You probably shouldn't do that.
	
	$.Config.keyCombine = ["equips", "note", "traits", "learnings", "effects"];
    $.Config.keyMerge = ["events"];
    $.Config.keyXDiff = ["list"];
	
    $.Helpers.strEq = function(left, right) {
		return JSON.stringify(left) === JSON.stringify(right);
	}

    $.Helpers.hashCode = function(string){
        let hash = 0;
        for (let i = 0; i < string.length; i++) {
            let code = string.charCodeAt(i);
            hash = ((hash<<5)-hash)+code;
            hash = hash & hash;
        }
        return hash;
    }

    $.Helpers.dedup = function(arr) {
        const a = arr.concat();
        for(let i = 0; i < a.length; ++i) {
            for(let j = i + 1; j < a.length; ++j) {
                if(this.strEq(a[i], a[j]))
                    a.splice(j--, 1);
            }
        }
        return a;
    };
	
	$.Helpers.move = function(array, index, delta) {
		const newIndex = index + delta;
		if (newIndex < 0 || newIndex == array.length) return;
		const indexes = [index, newIndex].sort((a, b) => a - b);
		array.splice(indexes[0], 2, array[indexes[1]], array[indexes[0]]);
	}

    $.Helpers.createPath = function(wrath) {
		const oldVersion = window.location.pathname !== "/index.html";
        oldVersion && (wrath = "/" + wrath);
        wrath += (wrath === "") ? "./" : "/";
        !(Utils.isNwjs() && Utils.isOptionValid("test")) && (wrath = "www/" + wrath);
        let path = window.location.pathname.replace(/(\/www|)\/[^\/]*$/, wrath);
        if (path.match(/^\/([A-Z]\:)/)) path = path.slice(1);
        path = decodeURIComponent(path);
        return path;
    };

    $.Helpers.getFilesRecursively = function(path) {
        const files = [];
        const filesInPath = fs.readdirSync(path);
        for (const file of filesInPath) {
            const absolute = path + "/" + file;
            if (fs.statSync(absolute).isDirectory()) {
                files.push(...this.getFilesRecursively(absolute));
            } else files.push(absolute);
        }
        return files;
    };
	
	$.Helpers.getFolders = function(path) {
		const folders = [];
        const foldersInPath = fs.readdirSync(path);
        for (const folder of foldersInPath) {
            const absolute = path + "/" + folder;
            if (fs.statSync(absolute).isDirectory()) {
                folders.push(folder);
            }
        }
        return folders;
	};
	
	$.Helpers.getFiles = function(path) {
		const files = [];
        const filesInPath = fs.readdirSync(path);
        for (const file of filesInPath) {
            const absolute = path + "/" + file;
            if (!fs.statSync(absolute).isDirectory()) {
                files.push(file);
            }
        }
        return files;
	};

    $.Helpers.deepWriteSync = function(path, file) {
        this.ensureDirectoryExistence(path);
        fs.writeFileSync(path, file);
    }

    $.Helpers.ensureDirectoryExistence = function(path) {
        const index = path.lastIndexOf('/');
        if (index === -1) return;

        const directory = path.substring(0, index);
        if (fs.existsSync(directory)) return;
        this.ensureDirectoryExistence(directory);
        fs.mkdirSync(directory);
    }

    $.Helpers.appendix = function(path) {
        const index = path.indexOf('/www');
        return path.substr(index + 5);
    }
	
	/************************************************************************************/

    $.Params.root = $.Helpers.createPath("");
    $.Params.modsPath = $.Params.root + "mods/";
    $.Params.backupsPath = $.Params.root + "backups/";
    $.Params.diffsPath = $.Params.root + "diffs/";
	
	$.Params.reboot = false;

    $.readMods = function () {
        const overridePaths = {};
		const modFolders = $.Helpers.getFolders($.Params.modsPath);

        let mods = $.sortMods(modFolders);
		mods = mods.filter(m => $.getEnabled(m));
		
		if (mods.length === 0) {
			const results = $.Helpers.getFilesRecursively($.Params.backupsPath);
			for (let i = 0; i < results.length; i++) {
				const index = results[i].indexOf('/backups');
				const keyPath = results[i].substr(index + 10);
				const originPath = $.Params.root + keyPath;
				const backupFile = fs.readFileSync(results[i]);
                $.Helpers.deepWriteSync(originPath, backupFile);
			} return;
		}
				
        for (let i = 0; i < mods.length; i++) {
            const modPath = $.Params.modsPath + mods[i] + "/www";
            const datas = $.Helpers.getFolders(modPath)
				.filter(d => d.includes("data")).sort();
            const others = $.Helpers.getFolders(modPath)
				.filter(d => !d.includes("data")).sort();

            for (let j = 0; j < datas.length; j++) {
                const dataPath = modPath + "/" + datas[j]
                const results = $.Helpers.getFilesRecursively(dataPath);
                for (let k = 0; k < results.length; k++) {
                    const keyPath = $.Helpers.appendix(results[k]);
                    $.backup(results[k]);

                    if (!overridePaths[keyPath])
                        overridePaths[keyPath] = [];
                    overridePaths[keyPath].push(results[k]);
                }
            }

            for (let j = 0; j < others.length; j++) {
				const otherPath = modPath + "/" + others[j]
                const results = $.Helpers.getFilesRecursively(otherPath);
                for (let k = 0; k < results.length; k++) {
					if (results[k].match(/plugins[^\/]*\.js/)) {
						// TODO: Merge plugins
					} else {
						const keyPath = $.Helpers.appendix(results[k]);
						const file = fs.readFileSync(results[k]);
						$.Helpers.deepWriteSync($.Params.root + keyPath, file);
					}
                }
            }
        }

        Object.keys(overridePaths).forEach(function(key) {
            const backupPath = $.Params.backupsPath + key;
            const backupFile = fs.readFileSync(backupPath);
            const backupData = JSON.parse(backupFile);

            let targetData = JSON.parse(backupFile);
            const sourcePaths = overridePaths[key];
            for (let i = 0; i < sourcePaths.length; i++) {
                const sourceFile = fs.readFileSync(sourcePaths[i]);
                const sourceData = JSON.parse(sourceFile);

                if ($.Config.reduceModData) {
                    const reducedData = $.reduceData(backupData, sourceData)
                    targetData = $.mergeData(backupData, reducedData, targetData);

                    if (!$.Helpers.strEq(sourceData, reducedData)) {
                        const reducedStr = JSON.stringify(reducedData);
                        $.Helpers.deepWriteSync(sourcePaths[i], reducedStr);
                    }
                } else {
                    targetData = $.mergeData(backupData, sourceData, targetData);
                }
            }

            const path = $.Params.root + key;
            $.Helpers.deepWriteSync(path, JSON.stringify(targetData));
        });
    };

    $.backup = function(path) {
        const keyPath = $.Helpers.appendix(path);
        const backupPath = $.Params.backupsPath + keyPath;
        const originPath = $.Params.root + keyPath;

        if (!fs.existsSync(backupPath) || $.Config.forceBackup) {
            if (fs.existsSync(originPath)) {
                const backupFile = fs.readFileSync(originPath);
                $.Helpers.deepWriteSync(backupPath, backupFile);
            } else {
                const backupFile = fs.readFileSync(path)
                $.Helpers.deepWriteSync(backupPath, backupFile);
            }
        }
    }

    $.mergeData = function(original, source, target) {
        const result = JSON.parse(JSON.stringify(target));
        if (Array.isArray(source) && Array.isArray(target)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                const oi = original ? original.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                const ti = target ? target.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                if (oi >= 0 && ti >= 0) result[ti] = $.mergeData(original[oi], source[i], target[ti]);
                else if (ti >= 0) result[ti] = $.mergeData(target[ti], source[i], target[ti]);
                else result.push(source[i]);
            }
        } else {
            Object.keys(source).forEach(function(key) {
                if (target && key in target) {
                    if ($.Config.keyCombine.includes(key)) {
                        const aux = result[key].concat(source[key]);
                        if (Array.isArray(source[key]))
                            result[key] = $.Helpers.dedup(aux);
                        else result[key] = aux;
                    } else if ($.Config.keyMerge.includes(key)) {
                        result[key] = $.mergeData(original[key], source[key], target[key]);
                    } else if ($.Config.keyXDiff.includes(key)) {
                        if (Array.isArray(source[key])) {
                            const sh = $.Helpers.hashCode(JSON.stringify(source[key]))
                            const oh = $.Helpers.hashCode(JSON.stringify(original[key]))
                            const th = $.Helpers.hashCode(JSON.stringify(target[key]))
                            const xx = sh.toString() + oh.toString() + th.toString();
                            const path = $.Params.diffsPath + xx + ".json"
                            if (fs.existsSync(path)) {
                                const os = original[key].map((obj) => JSON.stringify(obj));
                                const diffFile = fs.readFileSync(path);

                                const diff = JSON.parse(diffFile);
                                const rs = xdiff.patch(os, diff);
                                result[key] = rs.map((str) => JSON.parse(str));
                            } else {
                                const ss = source[key].map((obj) => JSON.stringify(obj));
                                const os = original[key].map((obj) => JSON.stringify(obj));
                                const ts = target[key].map((obj) => JSON.stringify(obj));

                                const diff = xdiff.diff3(ss, os, ts);
                                const rs = xdiff.patch(os, diff);
                                result[key] = rs.map((str) => JSON.parse(str));

                                $.Helpers.deepWriteSync(path, JSON.stringify(diff));
                            }
                        } else {
                            const diff = xdiff.diff3(source[key], original[key], target[key]);
                            result[key] = xdiff.patch(original[key], diff);
                        }
                    } else if (!result[key] || source[key]){
						result[key] = source[key];
					}
                } else result[key] = source[key];
            });
        }

        return result;
    }

    $.reduceData = function(original, source) {
        const result = JSON.parse(JSON.stringify(source));
        if (Array.isArray(original) && Array.isArray(source)) {
            for (let i = 0; i < source.length; i++) {
                if (source[i] == null) continue;
                const ri = result ? result.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
                const oi = original ? original.findIndex(x => x && x["id"] === source[i]["id"]) : -1;
				
                if (ri >= 0 && oi >= 0) {
                    if ($.Helpers.strEq(original[oi], source[i])) {
                        result.splice(ri, 1);
                    }
                }
            }
			result.filter(x => x)
        } else {
            Object.keys(source).forEach(function(key) {
                if (original && key in original) {
                    if ($.Helpers.strEq(original[key], source[key])) {
                        delete result[key];
                    }
                }
            });
        }

        return result;
    }
	
	$.sortMods = function(mods) {
		const orderPath = $.Params.root + "order.json";		
		if (fs.existsSync(orderPath)) {
			const orderFile = fs.readFileSync(orderPath);
			let order = JSON.parse(orderFile);
			order = order.filter(m => mods.includes(m));
			for (let i = 0; i < mods.length; i++) {
				if (!order.includes(mods[i])) {
					order.push(mods[i]);
				}
			}
			
			return order;
		}
		
		return mods;
	}
	
	$.getEnabled = function(symbol) {
		const enabledPath = $.Params.root + "enabled.json";
		if (!fs.existsSync(enabledPath)) return false;
		const enabledFile = fs.readFileSync(enabledPath);
		return JSON.parse(enabledFile)[symbol];
	}
	
	$.setEnabled = function(symbol, value) {
		const enabledPath = $.Params.root + "enabled.json";
		let enabled = {};
		
		if (fs.existsSync(enabledPath)) {
			const enabledFile = fs.readFileSync(enabledPath);
			enabled = JSON.parse(enabledFile);
		}

		enabled[symbol] = value;
		$.Helpers.deepWriteSync(enabledPath, JSON.stringify(enabled));
	}
			
	/************************************************************************************/
	
	$.Holder.makeCommandList = Window_TitleCommand.prototype.makeCommandList;
	Window_TitleCommand.prototype.makeCommandList = function() {
		$.Holder.makeCommandList.call(this);
		this.addCommand("Mods", 'mods');
	};
	
	$.Holder.createCommandWindow = Scene_Title.prototype.createCommandWindow;
	Scene_Title.prototype.createCommandWindow = function() {
		$.Holder.createCommandWindow.call(this);
		this._commandWindow.setHandler('mods', this.mods.bind(this));
	};

	Scene_Title.prototype.mods = function() {
		SceneManager.push(Scene_Mods);
	};
	
	$.readMods();

})(ModLoader);

/************************************************************************************/

function Scene_Mods() {
	this.initialize.apply(this, arguments);
}

Scene_Mods.prototype = Object.create(Scene_MenuBase.prototype);
Scene_Mods.prototype.constructor = Scene_Mods;

Scene_Mods.prototype.initialize = function() {
	Scene_MenuBase.prototype.initialize.call(this);
};

Scene_Mods.prototype.create = function() {
	Scene_MenuBase.prototype.create.call(this);
	this.createModsWindow();
};

Scene_Mods.prototype.terminate = function() {
	Scene_MenuBase.prototype.terminate.call(this);
};

Scene_Mods.prototype.createModsWindow = function() {
	this._modsWindow = new Window_Mods();
	this._modsWindow.setHandler('cancel', this.popScene.bind(this));
	this.addWindow(this._modsWindow);
};

Scene_Mods.prototype.popScene = function() {
	if (ModLoader.Params.reboot) SceneManager.exit()
	Scene_MenuBase.prototype.popScene.call(this);
}

/************************************************************************************/

function Window_Mods() {
	this.initialize.apply(this, arguments);
}

Window_Mods.prototype = Object.create(Window_Command.prototype);
Window_Mods.prototype.constructor = Window_Mods;

Window_Mods.prototype.initialize = function() {
	Window_Command.prototype.initialize.call(this, 0, 0);
	this.updatePlacement();
};

Window_Mods.prototype.windowWidth = function() {
	return 400;
};

Window_Mods.prototype.windowHeight = function() {
	return this.fittingHeight(Math.min(this.numVisibleRows(), 12));
};

Window_Mods.prototype.updatePlacement = function() {
	this.x = (Graphics.boxWidth - this.width) / 2;
	this.y = (Graphics.boxHeight - this.height) / 2;
};

Window_Mods.prototype.makeCommandList = function() {
	const modsPath = ModLoader.Params.modsPath;
	const modFolders = ModLoader.Helpers.getFolders(modsPath);
	const mods = ModLoader.sortMods(modFolders);
	for (let i = 0; i < mods.length; i++ ) {
		this.addCommand("↕ " + mods[i], mods[i]);
	}
};

Window_Mods.prototype.drawItem = function(index) {
	var rect = this.itemRectForText(index);
	var statusWidth = this.statusWidth();
	var titleWidth = rect.width - statusWidth;
	this.resetTextColor();
	this.changePaintOpacity(this.isCommandEnabled(index));
	this.drawText(this.commandName(index), rect.x, rect.y, titleWidth, 'left');
	this.drawText(this.statusText(index), titleWidth, rect.y, statusWidth, 'right');
};

Window_Mods.prototype.statusWidth = function() {
	return 120;
};

Window_Mods.prototype.statusText = function(index) {
	var symbol = this.commandSymbol(index);
	var value = ModLoader.getEnabled(symbol);
	return this.booleanStatusText(value);
};

Window_Mods.prototype.booleanStatusText = function(value) {
	return value ? 'ON' : 'OFF';
};

Window_Mods.prototype.processOk = function() {
	var index = this.index();
	var symbol = this.commandSymbol(index);
	var value = ModLoader.getEnabled(symbol);
	this.changeValue(symbol, !value);
};

Window_Mods.prototype.cursorRight = function(wrap) {
	var index = this.index();
	var symbol = this.commandSymbol(index);
	this.changeValue(symbol, true);
};

Window_Mods.prototype.cursorLeft = function(wrap) {
	var index = this.index();
	var symbol = this.commandSymbol(index);
	this.changeValue(symbol, false);
};

Window_Mods.prototype.cursorPageup = function() {
	var index = this.index();
	const modFolders = ModLoader.Helpers.getFolders(modsPath);
	const mods = ModLoader.sortMods(modFolders);
	ModLoader.Helpers.move(mods, index, -1);

	const orderPath = ModLoader.Params.root + "order.json";
	ModLoader.Helpers.deepWriteSync(orderPath, JSON.stringify(mods));
	ModLoader.Params.reboot = true;
	this.refresh();
};

Window_Mods.prototype.cursorPagedown = function() {
	var index = this.index();
	const modFolders = ModLoader.Helpers.getFolders(modsPath);
	const mods = ModLoader.sortMods(modFolders);
	ModLoader.Helpers.move(mods, index, 1);

	const orderPath = ModLoader.Params.root + "order.json";
	ModLoader.Helpers.deepWriteSync(orderPath, JSON.stringify(mods));
	ModLoader.Params.reboot = true;
	this.refresh();
};

Window_Mods.prototype.changeValue = function(symbol, value) {
	var lastValue = ModLoader.getEnabled(symbol);
	if (lastValue !== value) {
		ModLoader.setEnabled(symbol, value);
		this.redrawItem(this.findSymbol(symbol));
		SoundManager.playCursor();
	} ModLoader.Params.reboot = true;
};