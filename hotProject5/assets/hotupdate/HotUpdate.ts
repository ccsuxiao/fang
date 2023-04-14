import { UpdatePanel } from './UpdatePanel';

const jsb = (<any>window).jsb;

import { _decorator, Component, Node, Label, ProgressBar, Asset, game, sys, EventTouch, director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HotUpdate')
export class HotUpdate extends Component {

    @property(UpdatePanel)
    panel: UpdatePanel = null!;

    @property(Asset)
    manifestUrl: Asset = null!;

    @property(Node)
    updateUI: Node = null!;

    @property(Node)
    btnStart: Node = null!;

    private _updating = false;
    private _canRetry = false;
    private _storagePath = '';
    private _am: jsb.AssetsManager = null!;

    checkCb(event: any) {
        console.log('Code: ' + event.getEventCode());
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                console.error("No local manifest file found, hot update skipped.");
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                console.error("Fail to download manifest file, hot update skipped.");
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.panel.info.string = "Already up to date with the latest remote version.";
                this.btnStart.active = true;
                break;
            case jsb.EventAssetsManager.NEW_VERSION_FOUND:
                this.panel.info.string = 'New version found, please try to update. (' + Math.ceil(this._am.getTotalBytes() / 1024) + 'kb)';
                this.panel.checkBtn.active = false;
                this.updateUI.active = true;
                this.panel.fileProgress.progress = 0;
                this.panel.byteProgress.progress = 0;
                break;
            default:
                return;
        }


        this._am.setEventCallback(null!);
        this._updating = false;
    }

    updateCb(event: any) {
        var needRestart = false;
        var failed = false;
        switch (event.getEventCode()) {
            case jsb.EventAssetsManager.ERROR_NO_LOCAL_MANIFEST:
                this.panel.info.string = 'No local manifest file found, hot update skipped.';
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_PROGRESSION:
                this.panel.byteProgress.progress = event.getPercent();
                this.panel.fileProgress.progress = event.getPercentByFile();

                this.panel.fileLabel.string = event.getDownloadedFiles() + ' / ' + event.getTotalFiles();
                this.panel.byteLabel.string = event.getDownloadedBytes() + ' / ' + event.getTotalBytes();
                console.log(this.panel.fileLabel.string, this.panel.byteLabel.string);
                var msg = event.getMessage();
                if (msg) {
                    this.panel.info.string = 'Updated file: ' + msg;
                    // cc.log(event.getPercent()/100 + '% : ' + msg);
                }
                break;
            case jsb.EventAssetsManager.ERROR_DOWNLOAD_MANIFEST:
            case jsb.EventAssetsManager.ERROR_PARSE_MANIFEST:
                this.panel.info.string = 'Fail to download manifest file, hot update skipped.';
                failed = true;
                break;
            case jsb.EventAssetsManager.ALREADY_UP_TO_DATE:
                this.panel.info.string = 'Already up to date with the latest remote version.';
                failed = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FINISHED:
                this.panel.info.string = 'Update finished. ' + event.getMessage();
                needRestart = true;
                break;
            case jsb.EventAssetsManager.UPDATE_FAILED:
                this.panel.info.string = 'Update failed. ' + event.getMessage();
                this.panel.retryBtn.active = true;
                this._updating = false;
                this._canRetry = true;
                this.updateUI.active = true;
                this.panel.checkBtn.active = false;
                break;
            case jsb.EventAssetsManager.ERROR_UPDATING:
                this.panel.info.string = 'Asset update error: ' + event.getAssetId() + ', ' + event.getMessage();
                break;
            case jsb.EventAssetsManager.ERROR_DECOMPRESS:
                this.panel.info.string = event.getMessage();
                break;
            default:
                break;
        }

        //无需错误处理和失败重试，取消事件回调
        if (failed) {
            this._am.setEventCallback(null!);
            this._updating = false;
        }

        if (needRestart) {
            this._am.setEventCallback(null!);
            // Prepend the manifest's search path
            var searchPaths = jsb.fileUtils.getSearchPaths();
            var newPaths = this._am.getLocalManifest().getSearchPaths();
            console.log(JSON.stringify(newPaths));
            //判断newPaths是否已经存在于searchPaths顶部
            let needChange = false
            for (let i = 0; i < newPaths.length; i++) {
                if (!searchPaths[i] || newPaths[i] != searchPaths[i]) {
                    needChange = true
                    break
                }
            }
            if (needChange) {
                // This value will be retrieved and appended to the default search path during game startup,
                // please refer to samples/js-tests/main.js for detailed usage
                // !!! Re-add the search paths in main.js is very important, otherwise, new scripts won't take effect.
                Array.prototype.unshift.apply(searchPaths, newPaths);
                jsb.fileUtils.setSearchPaths(searchPaths);
            }
            localStorage.setItem('HotUpdateSearchPaths', JSON.stringify(searchPaths));
            // restart game.
            setTimeout(() => {
                game.restart();
            }, 500)
        }
    }

    //仅下载之前失败的资源
    retry() {
        if (!this._updating && this._canRetry) {
            this.panel.retryBtn.active = false;
            this._canRetry = false;
            console.log('Retry failed Assets...')
            this._am.downloadFailedAssets();
        }
    }

    checkUpdate() {
        if (this._updating) {
            console.log('Checking or updating ...')
            return;
        }
        if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
            var url = this.manifestUrl.nativeUrl;
            this._am.loadLocalManifest(url);
        }
        if (!this._am.getLocalManifest() || !this._am.getLocalManifest().isLoaded()) {
            console.error('Failed to load local manifest ...');
            return;
        }

        this._am.setEventCallback(this.checkCb.bind(this));

        this._am.checkUpdate();
        this._updating = true;
    }

    hotUpdate() {
        if (this._am && !this._updating) {
            this._am.setEventCallback(this.updateCb.bind(this));

            if (this._am.getState() === jsb.AssetsManager.State.UNINITED) {
                var url = this.manifestUrl.nativeUrl;
                this._am.loadLocalManifest(url);
            }

            this._am.update();
            this.panel.updateBtn.active = false;
            this._updating = true;
        }
    }

    // use this for initialization
    onLoad() {
        // Hot update is only available in Native build
        if (!jsb) {
            return;
        }
        this.updateUI.active = false;
        this.btnStart.active = false;
        director.preloadScene("game", () => {
            console.log('Next scene preloaded');
        })

        this.btnStart.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            director.loadScene("game");
        })
        this._storagePath = ((jsb.fileUtils ? jsb.fileUtils.getWritablePath() : '/') + 'blackjack-remote-asset');
        console.log('Storage path for remote asset : ' + this._storagePath);

        // Init with empty manifest url for testing custom manifest
        this._am = new jsb.AssetsManager('', this._storagePath);

        var panel = this.panel;
        // Setup the verification callback, but we don't have md5 check function yet, so only print some message
        // Return true if the verification passed, otherwise return false
        this._am.setVerifyCallback(function (path: string, asset: any) {
            // When asset is compressed, we don't need to check its md5, because zip file have been deleted.
            var compressed = asset.compressed;
            // Retrieve the correct md5 value.
            var expectedMD5 = asset.md5;
            // asset.path is relative path and path is absolute.
            var relativePath = asset.path;
            // The size of asset file, but this value could be absent.
            var size = asset.size;
            if (compressed) {
                panel.info.string = "Verification passed : " + relativePath;
                return true;
            }
            else {
                panel.info.string = "Verification passed : " + relativePath + ' (' + expectedMD5 + ')';
                return true;
            }
        });

        this.panel.info.string = 'Hot update is ready, please check or directly update.';
        this.panel.fileProgress.progress = 0;
        this.panel.byteProgress.progress = 0;

        this.checkUpdate()
    }

    onDestroy() {
        this._am.setEventCallback(null!);
    }
}
