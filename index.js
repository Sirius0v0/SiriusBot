"use strict"
const account = 447010560;

const bot = require("oicq").createClient(account)

bot.on("system.login.qrcode", function (e) {
	this.logger.mark("扫码后按Enter完成登录") //通过扫码二维码登录
	process.stdin.once("data", () => {
		this.login()
	})
})
	.on("system.login.error", function (e) {
		if (e.code < 0)
			this.login()
	})
	.login()

exports.bot = bot

/* ====== Plugins ====== */

// test plugins
require("./src/app-plugin/others/plugin-hello") //hello world
require("./src/app-plugin/others/plugin-image") //发送图文和表情

// sys
require("./src/sys/plugin-online") //监听上线事件

// games
require("./src/app-plugin/games/24points/plugin-24points") // 24点游戏