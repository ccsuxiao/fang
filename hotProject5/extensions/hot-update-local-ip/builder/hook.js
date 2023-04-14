
'use strict';

const os = require("os");
const fs = require("fs");
const path = require("path");
const { exec } = require('child_process');

const remote_port = 7879;
const remote_path = "tutorial-hot-update/remote-assets/";

function getIPAdress() {
    var interfaces = os.networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];
        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
        }
    }
}

exports.onAfterBuild = function (options, result) {
    let resdir = 'assets';

    if (fs.existsSync(path.join(result.dest, 'data'))) {
        resdir = 'data';
    }

    var url = path.join(Editor.Project.path, "assets/hotupdate", 'hotConfig.ts');
    fs.readFile(url, "utf8", function (err, data) {
        if (err) {
            throw err;
        }
        let GameVersion = data.slice(data.indexOf('"')+1,data.lastIndexOf('"'))
        console.warn(GameVersion);
        let cmd = `node version_generator.js -v ${GameVersion} -u http://${getIPAdress()}:${remote_port}/${remote_path} -s ${path.join(result.dest, resdir)} -d ${path.join(Editor.Project.path, "assets")}`    
        console.warn(cmd);
    
        exec(cmd, { cwd: Editor.Project.path }, (err, stdout, stderr) => {
            if (!err) return;
            console.error(err);
        });
    });
}
