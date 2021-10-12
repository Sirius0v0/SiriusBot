"use strict"
const { getPermission } = require("../../lib/permission");
const { emptyDir } = require("../../lib/remove");
const { Data } = require("./Data");
const { segment } = require("oicq");
const qmidi = require("quick-midi");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
let lastTime = Date.parse(new Date()) / 1000;
const cd = 10;
const help = `
[调教方法]
<-musicgen list>: 查看已保存的音乐
<-musicgen view 音乐名字>: 查看已保存的音乐乐谱
<-musicgen play 音乐名字>: 播放已保存的音乐
<-musicgen [Options] 乐谱>: 生成音乐,可选参数如下：
  -b, --bpm <正整数>: 音乐速度
  -s, --save <音乐名字> : 保存音乐
  -i, --instrument <音色编号>：音色
  -m, --major <曲调>：音乐曲调
【乐谱不可有空格，可用|分割】 

[音长写法规则]
全音符: 1---
二分音符: 1-
附点二分音符: 1-- 或 1-*
四分音符: 1
三连音：1//2//3//
附点四分音符: 1*
八分音符: 1_
十六分音符: 1__

[音高写法规则]
'和.分别将音符升和降八度
#和b分别升和降半调
例：1为C4，1''为C6
当音高达到两个极限值时则会被切断

[注] 
※ 竖线|可出现在序列中的任何位置，相当于虚词，无实意，只是为了增加可读性，如分隔小节.
※ 修饰符位于一个音符之后。_将音符长度减半，n个连续的-和*分别将长度增加n和(1 - 1 / 2^n)倍。也就是说这三个修饰符分别相当于简谱中的下划线、横线和附点.
※ 修饰符会影响{}中的所有音符。比如{123}//和1//2//3//是等价的、{1234}_和1_2_3_4_是等价的.
※ 表示连音使用修饰符/，n个/将音符长度除以(n + 1).
※ \\v{num}表示第num声部，例：\\v{1}1234567\\v{2}7654321
`.trim();

async function musicgen(_bot, data, args = null) {
    if (!await getPermission(data, "musicgen")) return;
    if (data.time - lastTime - cd < 1e-5) return;
    if (args?.length === 1 && ["help", '帮助'].indexOf(args?.[0]) !== -1) {
        data.reply(help);
        return;
    } else if (args?.length === 1 && ["list", '列表'].indexOf(args?.[0]) !== -1) {
        let nameList = new Data().getMusicName();
        if (nameList.length === 0) data.reply("我的音乐书空空如也~");
        else data.reply(`音乐书曲目：[${nameList.join(" | ")}]`);
        return;
    } else if (args?.length === 2 && ["view", '查谱'].indexOf(args?.[0]) !== -1) {
        let musicData = new Data();
        let nameList = musicData.getMusicName();
        if (nameList.indexOf(args[1]) === -1) {
            data.reply("音乐本中暂无该曲目");
            return;
        }
        let m = musicData.getMusic(args[1]);
        data.reply(m.slice(3 + m.indexOf("|||")));
        return;
    } else if (args?.length === 2 && ["play", '播放'].indexOf(args?.[0]) !== -1) {
        let musicData = new Data();
        let nameList = musicData.getMusicName();
        if (nameList.indexOf(args[1]) === -1) {
            data.reply("窝不会唱~你教我呗");
            return;
        }
        let genRes = genMidi(musicData.getMusic(args[1]), String(data.time));
        if (!genRes.res) {
            data.reply(genRes.errMsg);
            return;
        }
        lastTime = data.time;// 成功调用则更新调用时间
        await sendMusic(data);
        return;
    } else if (args?.length === 0) {
        data.reply(help);
        return;
    }
    let opts = parseArgs(args);
    if (opts.errMsg) {
        data.reply(opts.errMsg);
        return;
    }
    let genRes = genMidi(`\\major{${opts.major}}\\bpm{${opts.bpm}}\\instrument{${opts.instrument}}|||${opts.input}`, String(data.time));
    if (!genRes.res) {
        data.reply(genRes.errMsg);
        return;
    }
    lastTime = data.time;// 成功调用则更新调用时间
    if (opts.dump) {   // 保存
        let status = new Data().updateMusic(opts.dump, `\\major{${opts.major}}\\bpm{${opts.bpm}}\\instrument{${opts.instrument}}|||${opts.input}`);
        if (status) data.reply("保存成功");
        else data.reply("保存失败，名字已存在");
    }

    // let track = addNote(new MidiWriter.Track().setTempo(100), origin);
    // let write = new MidiWriter.Writer(track);
    // fs.writeFileSync(path.join(__dirname, "./cache/output.mid"), Buffer.from(write.buildFile()));
    await sendMusic(data);

}
exports.musicgen = musicgen;

function genMidi(input, name) {
    let info = { res: false, errMsg: null };
    let ctx = qmidi.createContext();
    let lines = input.split(/\n|\r\n|\r/);
    let midiFile;
    try {
        midiFile = ctx.parse(input);
    } catch (error) {
        info.errMsg = `Error: 乐谱错误\n错误标记：null`;
        return info;
    }
    let errors = ctx.getErrors();
    if (ctx.hasError()) {
        // for (let e of ctx.getPrintedErrors({ getLine: i => lines[i - 1] })) {
        //     console.log(e);
        // }
        info.errMsg = `Error: ${(errors[0]["msg"].startsWith("BPM") ||
            errors[0]["msg"].startsWith("Tempo")) ? "bpm参数非法或越界[4,16777215]" : "乐谱错误"}\n错误标记：${errors[0]["range"]["text"]}`;
        return info;
    }
    else {
        let midiData = qmidi.saveMidiFile(midiFile);
        if (!fs.existsSync(path.join(__dirname, './cache'))) fs.mkdirSync(path.join(__dirname, './cache'));
        fs.writeFileSync(path.join(__dirname, `./cache/${name}.mid`), Buffer.from(midiData))
        info.res = true;
        return info;
    }
}

function parseArgs(args) {
    let opts = { input: null, bpm: 120, instrument: 0, major: 'C', errMsg: null, dump: null };
    while (args.length) {
        if (args[0].charAt(0) === '-') {
            switch (args[0]) {
                case '-b':
                case '--bpm':
                    args.shift();
                    let bpm = Number(args.shift());
                    if (!Number.isInteger(bpm)) {
                        opts.errMsg = `参数错误：速度参数-b(--bpm)为正整数`;
                        return opts;
                    }
                    opts.bpm = bpm;
                    break;
                case '-i':
                case '--instrument':
                    args.shift();
                    let instrument = Number(args.shift());
                    if (!Number.isInteger(instrument)) {
                        opts.errMsg = `参数错误：音色参数-i为整数,请查阅http://www.music.mcgill.ca/~ich/classes/mumt306/StandardMIDIfileformat.html#BMA1_4`;
                        return opts;
                    }
                    opts.instrument = instrument;
                    break;
                case '-s':
                case '--save':
                    args.shift();
                    opts.dump = args.shift();
                    break;
                case '-m':
                case '--Major':
                    args.shift();
                    let major = args.shift();
                    const majorList = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C#', 'Cb', 'Db', 'Eb', 'F#', 'Gb', 'Ab', 'Bb'];
                    if (majorList.indexOf(major) === -1) {
                        opts.errMsg = `参数错误：曲调参数-m为表中其一[C, D, E, F, G, A, B, C#, Cb, Db, Eb, F#, Gb, Ab, Bb]`;
                        return opts;
                    }
                    opts.major = major;
                    break;
                default:
                    opts.errMsg = `未知参数 ${args[0]}`;
                    return opts;
            }
        }
        else {
            if (opts.input !== null) {
                opts.errMsg = "输入的乐谱太多了，尝试将空格删除或替换为|";
                return opts;
            }
            else {
                opts.input = args.shift();
            }
        }
    }
    return opts;
}

async function sendMusic(data) {
    let ls = spawn('java', ['-jar', path.join(__dirname, "./midi2wav.jar"), path.join(__dirname, `./cache/${String(data.time)}.mid`), path.join(__dirname, "./cache/")]);
    ls.stdout.on('data', (data) => {
        // console.log(`stdout: ${data}`);
    });
    ls.stderr.on('data', (data) => {
        // console.error(`stderr: ${data}`);
    });
    ls.on('close', async (code) => {
        await data.reply([segment.record(path.join(__dirname, `./cache/${String(data.time)}.wav`))])
        let files = fs.readdirSync(path.join(__dirname, "./cache"));
        if (files.length > 40) {
            emptyDir(path.join(__dirname, "./cache"));
        }
    });
}