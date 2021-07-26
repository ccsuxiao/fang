
const express = require('express');
const expressWs = require('express-ws');
const fileAction = require('./fileAction');

class StartServer {
  constructor() {
    this.app = null;
    this.userws = {};
    this.run();
  }
  run() {
    this.app = express();// 启动express框架
    expressWs(this.app); // 使得app支持websocket协议
    this.openCORS();
    this.setRouter();
    this.listenPort();//设置服务端的监听端口
  }

  openCORS() {
    // app.all 所有类型的请求 * 所有路由 开启跨域 
    // 浏览器根据响应头中的Access-Control-Allow-Origin字段会进行拦截处理
    this.app.all('*', (req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*')
      next();
    })
  }

  setRouter() {
    this.addWS();//启动监听wss://hcwb.boomegg.cn:80/game
    this.heartbeat();//向在线客户端发送心跳检测，每3秒一次
    this.heartbeat1();//每隔1分钟向在线客户端发送随机事件
  }

  //每隔1分钟向在线客户端发送随机事件
  heartbeat1() {
    setTimeout(() => {
      let onlineUserData = fileAction.getContent('onlineId'); //读取在线玩家名单
      if (Object.keys(onlineUserData).length > 0) {
        for (let i = 0; i < Object.keys(onlineUserData).length; i++) {
          if (this.userws[Object.keys(onlineUserData)[i]]) {//先要判断此ws是否还存在
            this.send(Object.keys(onlineUserData)[i], { //通过玩家openid向玩家客户端发送请求随机事件
              key: 'onLine',
              sub: 1,
              data: ''
            })
            console.log(`成功向${Object.keys(onlineUserData)[i]}发送`)
          }
        }
      }
      this.heartbeat1();//自己调用自己不间断
    }, 60000);//1分钟一次
  }

  //向在线客户端发送心跳检测，每3秒一次
  heartbeat() {
    setTimeout(() => {
      let onlineUserData = fileAction.getContent('onlineId');//读取在线玩家名单
      if (Object.keys(onlineUserData).length > 0) {
        for (let i = 0; i < Object.keys(onlineUserData).length; i++) {
          if (this.userws[Object.keys(onlineUserData)[i]]) {//先要判断此ws是否还存在
            if (this.userws[`${Object.keys(onlineUserData)[i]}state`]) {//程序进入前台与后台的判断，如果程序进入后台则不要发送心跳检测
              this.userws[`${Object.keys(onlineUserData)[i]}count`] += 1; //每发送一次玩家id对应的count值增加
              if (this.userws[`${Object.keys(onlineUserData)[i]}count`] < 3) { //玩家对应的count值达到3则代表玩家离线
                this.send(Object.keys(onlineUserData)[i], { //向客户端发送服务器将其count值加了的消息，让客户端发消息回应减掉
                  key: 'offLine1',
                  sub: 1,
                  data: ''
                })
                console.log(Object.keys(onlineUserData)[i] && this.userws[`${Object.keys(onlineUserData)[i]}count`]);
                console.log(`成功向${Object.keys(onlineUserData)[i]}发送心跳检测`)
              } else {
                //玩家count值超3，服务器主动断开与客户端的连接
                console.log(Object.keys(onlineUserData)[i] && this.userws[`${Object.keys(onlineUserData)[i]}count`]);
                console.log("是心跳检测导致的断开连接")
                //告诉客户端将客户端那边的ws置为空
                this.send(Object.keys(onlineUserData)[i], {
                  key: 'heartClosews',
                  sub: 1,
                  data: {
                  }
                })
                //调用removeWs函数将玩家ws置为空
                this.removeWs(Object.keys(onlineUserData)[i]);
              }
            }
          }
        }
      }
      //函数自己调用自己
      this.heartbeat();
    }, 3000);//3秒一次
  }

  //判断玩家最近离线时间是否为今天，如果不是则向客户端发消息更新玩家的转盘次数
  isToday(str, uid) {
    console.log('我进来了')
    if (new Date(str).toDateString() !== new Date().toDateString()) {//不是当天上线
      console.log('我发了--------------------')
      this.send(uid, {
        key: 'updateRCH',
        sub: 1,
        data: ''
      })
    }
  }

  //监听客户端发送的wss://hcwb.boomegg.cn:80/game请求
  addWS() {
    this.app.ws('/game', (ws, req) => {
      console.log('建立ws连接');
      //拿到玩家openid
      let { name } = req.query;
      //用来判断玩家是否在服务器未断开与玩家的客户端连接前又建立连接，从而规避bug
      this.userws[`${name}offLinestate`] = true;
      if (this.userws[name]) {
        this.userws[`${name}offLinestate`] = false;
        console.log('已经建立连接!')
      }
      //给玩家的ws绑定__userId属性为玩家的openid
      ws.__userId = name;
      //给userWs对象绑定以玩家openid为key值的ws
      this.userws[name] = ws;
      //用以服务器心跳检测
      this.userws[`${name}count`] = 0;
      //用以判断玩家切入后台15秒内是否切回前台，若为false则服务器主动断开与对应玩家的客户端连接
      this.userws[`${name}state`] = true;
      //向对应玩家客户端发送建立连接成功的消息
      this.send(name, {
        key: 'initonLine',
        sub: 1,
        data: {
        }
      })
      //判断玩家离线时是否更新玩家离线时间，规避可能玩家没领离线奖励情况的bug
      this.userws[name].__updateOff = true;
      console.log('玩家id:', name)
      let Offlinetime = null;
      if (fileAction.getContent('user')[name]) {
        Offlinetime = JSON.parse(JSON.stringify(fileAction.getContent('user')[name].Offlinetime));
      }
      console.log('上次离线时间', Offlinetime);
      //如果之前该玩家连接过服务器
      if (fileAction.getContent('user')[name]) {
        let t = new Date().getTime();
        console.log('上线时间', t);
        //判断离线时间是否满足更新转盘奖励的要求
        this.isToday(Offlinetime, name);
        console.log('离线时常', (t - Offlinetime) / 1000);
        //如果不是已经建立连接
        if (this.userws[`${name}offLinestate`]) {
          //向对应玩家的客户端发送离线时间
          this.send(name, {
            key: 'offLine',
            sub: 2,
            data: {
              msg: '产生离线收益',
              time: (t - Offlinetime) / 1000
            }
          })
        }
        //如果玩家的离线时常大于5分钟，服务端需收到客户端发送的玩家已经领取离线奖励才更新玩家的离线时间
        if ((t - Offlinetime) > 300000) {//大于5分钟
          this.userws[name].__updateOff = false;
          //如果不是已经建立连接
          if (this.userws[`${name}offLinestate`]) {
            this.userws[name].__updateOff = true;
          }
        } else {
          //玩家离线时需更新玩家的离线时间
          this.userws[name].__updateOff = true;
        }
      } else {
        //如果为第一次登录，在user表中建立
        let userData = fileAction.getContent('user');
        fileAction.setContent('user', Object.assign(userData, { [name]: { Offlinetime: null } }));
        console.log('我发了--------------------')
        //向对应玩家客户端发送更新转盘奖励次数
        this.send(name, {//第一次上线给抽奖次数
          key: 'updateRCH',
          sub: 1,
          data: ''
        })
      }
      //读取在线的玩家信息,需在user写入后
      let onlinedata = fileAction.getContent('onlineId');
      //修改该玩家的上线时间
      onlinedata[name] = new Date().getTime();
      //写入在线玩家的json
      fileAction.setContent('onlineId', onlinedata);
      //玩家上线后服务器监听玩家的ws，进行客户端与服务端的数据交互
      ws.on('message', (e) => {
        let clientData = JSON.parse(e);
        //监听玩家的客户端回应服务器的心跳检测
        if (clientData.key == 'offLine1') {
          //如果为0则不需要任何操作
          if (this.userws[`${ws.__userId}count`] == 0) {
          } else
            if (this.userws[`${ws.__userId}count`] != 0) {
              //如果大于0则将count置为0
              this.userws[`${ws.__userId}count`] = 0;
              console.log(`${ws.__userId}回应`, this.userws[`${ws.__userId}count`])
            }
        }
        //监听玩家后台的切入切出
        if (clientData.key == 'needoffLine') {
          //如果为切入后台
          if (clientData.sub == 1) {
            //因为qq的监听一次切入后台会触发两次，此if条件为规避此情况，同时为15秒判断做准备
            if (this.userws[`${ws.__userId}state`]) {
              this.userws[`${ws.__userId}state`] = false;
              //切入后台后开始计时，15秒后服务器主动断掉与对应玩家客户端的连接
              this.userws[`${ws.__userId}sid`] = setTimeout(() => {
                //如果15秒后还没有切入前台
                if (!this.userws[`${ws.__userId}state`]) {
                  console.log(ws.__userId, '是切入后台过久导致的断开连接')
                  //向对应玩家的客户端发送切入前台后需要重连的指令
                  this.send(ws.__userId, {
                    key: 'Reconnection',
                    sub: 1,
                    data: {
                    }
                  })
                  //断开与对应玩家的客户端连接
                  this.removeWs(ws.__userId);
                }
              }, 15000);
              console.log(`${ws.__userId}切出去了`);
            }
          } else if (clientData.sub == 2) {
            //因为qq的监听一次切入后台会触发两次，此if条件为规避此情况
            if (!this.userws[`${ws.__userId}state`]) {
              //同时清除切入后台的15秒倒计时
              clearTimeout(this.userws[`${ws.__userId}sid`])
              //心跳检测等条件都初始化
              this.userws[`${ws.__userId}count`] == 0;
              this.userws[`${ws.__userId}state`] = true;
              console.log(`${ws.__userId}切回来了`);
            }
          }
        }
        //监听离线时长大于5分钟的玩家领取离线奖励
        if (clientData.key == 'updateOfftime') {
          console.log('我接收到了你领取离线奖励')
          //更新玩家离线时长
          let data = fileAction.getContent('user');
          data[ws.__userId].Offlinetime = new Date().getTime();//离线时间
          fileAction.setContent('user', data);
          //同时玩家离线后需更新离线时间
          this.userws[ws.__userId].__updateOff = true;
        }

        //给出一个接口提供服务器的时间
        if (clientData.key == 'getTime') {
          console.log('我确实收到了')
          let curtime = new Date().getTime();
          this.send(ws.__userId, {
            key: "currentTime",
            data: {
              time: curtime
            }
          })
        }
      })
    })
  }

  //服务端断开与对应玩家的客户端的连接的函数
  removeWs(uid) {//如需重启服务器，先关掉所有在线的ws，存储离线时间。
    console.log(uid + '断开连接');
    //玩家离线需判断是否需要更新离线时间
    if (this.userws[uid]) {
      if (this.userws[uid].__updateOff) {
        console.log(uid + '我触发了这里');
        //将玩家离线时间更新至user.json表
        let data = fileAction.getContent('user');
        data[uid].Offlinetime = new Date().getTime();//离线时间
        fileAction.setContent('user', data);
      }
      //删除玩家的ws
      clearTimeout(this.userws[`${uid}sid`]);
      //1秒时间规避所有正在执行的程序
      setTimeout(() => {
        delete this.userws[uid];
        console.log('bbbbbbbbb', this.userws[`${uid}`])
        delete this.userws[`${uid}sid`];
        delete this.userws[`${uid}count`];
        delete this.userws[`${uid}state`];
      }, 1000);
      //更新记录在线玩家的onlineId.json表
      let onlinedata = fileAction.getContent('onlineId');
      console.log(onlinedata)
      delete onlinedata[uid];
      fileAction.setContent('onlineId', onlinedata);
    }
  }



  //通过玩家openid返回玩家对应的ws
  getWs(uid) {
    return this.userws[uid];
  }

  //获得所有在线玩家的ws，可用于消息推送
  getAllWs() {
    return this.userws;
  }

  //服务端通过玩家id向客户端发送数据的函数
  send(uid, data) {
    try {
      this.getWs(uid).send(JSON.stringify(data));
    } catch (error) {
      if (this.userws[`${uid}state`]) {
        console.log("是发送失败导致的断开连接")
        //断开与客户端的连接
        this.removeWs(uid);
      }
    }
  }

  //服务端监听的端口设置
  listenPort(port = 443) {
    this.app.listen(port)
    console.log(`server is running,port is ${port}`);
  }
}
global.server = new StartServer();
module.exports = global.server;
// AMD vs CMD vs COMMONJS vs ES6原生import export 之间的差异
// nodejs 模块管理遵循commonjs规范
// es6 模块管理遵循原生import export规范

