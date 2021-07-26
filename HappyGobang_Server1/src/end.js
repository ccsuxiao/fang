const fileAction = require('./fileAction');
class end {
    constructor() {
        this.run();
    }
    run() {
        setTimeout(() => {
            let data = fileAction.getContent('onlineId');
            let userdata = fileAction.getContent('user');
            let arr = Object.keys(data);
            let time = new Date().getTime();//离线时间
            for(let i=0;i<arr.length;i++){
                userdata[arr[i]] = time;
            }
            fileAction.setContent('user',userdata);
            data = {};
            fileAction.setContent('onlineId',data);
        }, 1000);
    }
}
module.exports = new end();