const fs = require('fs')
const path = require('path')

const store = {
    userData: {},
    onlineIdData:{},
    configData: {},
}

class FileAction {
    constructor() {
        this.getFilesName()
            .then((files)=>{
                this.readAllFile(files);
            })
            .catch(err => {
                console.log(err);
            })
    }
    getFilesName(){
        return new Promise((resolve,reject)=>{
            //fs.readdir 读取文件下的所有子级文件，返回文件名（包括后缀）
            fs.readdir(path.resolve(__dirname,'../data'),'utf8',(err,files)=>{
                if(err){
                    return reject(err);
                }
                resolve(files.map(e=>e.replace('.json','')));
            })
        });
    }
    getName(name){
        return `${name}Data`;
    }
    readAllFile(files){
        Promise
            .all(files.map(e=>this.readFile(e)))
            .then(fileList=>{
                fileList.forEach(obj => {
                    store[this.getName(obj.name)] = obj.data;
                    console.log(store)
                }
                )
            })
            .catch(err => {
                console.log(1111,err);
            })
    }
    getDir(name){
        return path.resolve(__dirname,`../data/${name}.json`);
    }
    readFile(fileName) {
        // 异步过程
        return new Promise((resolve,reject)=>{
            let dir = this.getDir(fileName);
            fs.readFile(dir, 'utf8', (err, data) => {
                if (err) {
                    console.log(`读取${dir}异常`,`${err}`);
                    return resolve({name:fileName,data:{}});
                }
                data && (data = JSON.parse(data))
                console.log(`读取${dir}成功`, data);
                resolve({name:fileName,data});
            });
        })
    }
    
    getContent(name) {
        return store[this.getName(name)];
    }

    setContent(name,data) {
        let dir = this.getDir(name);
        fs.writeFile(dir, JSON.stringify(data), 'utf8', (err) => {
            if (err) {
                return console.log(`写${dir}异常`, err)
            }
            store[this.getName(name)] = data;
            console.log(data)
            console.log(`写${dir}成功`);
        })
    }
}

module.exports = new FileAction();
