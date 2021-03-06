"use strict"
const { segment } = require("oicq")
const { getPermission } = require("../lib/permission");
const help = `
[为你百度 帮助]
使用命令<-百度 要百度的内容>帮你百度一下~
`.trim();

async function baiduForU(_bot, data, args = null) {
    if (!await getPermission(data, "百度")) return;
    if (args?.length === 1 && ["help", '帮助'].indexOf(args?.[0]) !== -1) {
        data.reply(help);
        return;
    } else if (args?.length === 0) {
        data.reply(help);
        return;
    }
    data.reply([segment.share(`https://lmbtfy.cn/?q=${args.join(" ")}`, `${args.join(" ")}`,
        "https://www.baidu.com/img/PCtm_d9c8750bed0b3c7d089fa7d55720d6cf.png",
        `让我来为你百度`)]);
}

exports.baiduForU = baiduForU;