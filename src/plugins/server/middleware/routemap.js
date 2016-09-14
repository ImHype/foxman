import {
    util
} from '../../../helper';
import path from 'path';
import _ from 'util';
/**
 * 全局中间件,会将具体的页面转换成需要的资源
 * 1.同步
 * {
 *  path,syncData
 * }
 * 2.异步
 * {
 *  asyncData
 * }
 * @param  {[type]} config [description]
 * @return {[type]}        [description]
 */

const fileDispatcher = (config) => {
  const routeMap = new Map();
  routeMap.set('/', function ( { dirPath } ) {
    this.dispatcher = util.dispatcherTypeCreator(
        'dir', dirPath, null
    );
  });

  routeMap.set(`.${config.extension}`, function ({ commonTplPath, commonSync}) {
    this.dispatcher = util.dispatcherTypeCreator(
        'sync', commonTplPath, commonSync
    );
  });

  routeMap.set('.json', function ( { commonAsync } ) {
    this.dispatcher = util.dispatcherTypeCreator(
        'async', commonAsync, commonAsync
    );
  });
  return routeMap;
}

export default (config) => {
    const routeMap = fileDispatcher(config);
    return function*(next) {
        /**
         * mode 1 拦截文件夹的路径
         */
        if ((this.request.query.mode == 1) && this.request.path.endsWith('/')) {
            let dirPath = path.join( config.viewRoot, this.request.path );
            routeMap.get('/').call( this, { dirPath });
            return yield next;
        }

        /**
         * ① 拦截 router
         * @type {[type]}
         */
        const [routers, method] = [config.routers, this.request.method];

        /**
         * 入口时，自动转换
         */
        let requestPath = ( this.request.path == '/' ) ? '/index.html' : this.request.path;
        
        /**
         * 路径统一绝对路径
         */
        const requestInfo = {};
        /**
         * computedTplPath 与 tplPath 的区别是 在 请求url为'/'的时候
         * 前者为 '.../tpl/',
         * @type {[string]}
         */
        requestInfo.commonTplPath = path.join( config.viewRoot, this.request.path );

        /**
         * 根据用户定义的规则和url,生成通用的同步数据路径
         * @type {[string]}
         */
        requestInfo.commonSync = config.syncDataMatch( util.jsonPathResolve(requestPath) );

        /**
         * 根据用户定义的规则和url,生成通用的异步数据路径
         * @type {[string]}
         */
        requestInfo.commonAsync = config.asyncDataMatch( util.jsonPathResolve(requestPath) );

        /**
         * 遍历路由表,并给请求对象处理,生成 this.dispatcher
         */
        for ( let router of routers ) {
            if (router.method.toUpperCase() == method.toUpperCase() &&
                router.url == this.request.path) {
                let tplPath = path.join(config.viewRoot, `${util.removeSuffix(router.filePath)}.${config.extension}`);
                /**
                 * 同步接口
                 * 可能插件会生成一个 syncData ,若已生成则用插件的
                 * 即: 插件对于响应,有更高的权限
                 */
                if (router.sync) {
                    this.dispatcher = util.dispatcherTypeCreator(
                        'sync',
                        tplPath,
                        router.syncData || requestInfo.commonSync
                    );
                } else {
                    /**
                     * 如果插件已生成了 asyncData 属性,则用插件的
                     * 即: 插件对于响应,有更高的权限
                     */
                    this.dispatcher = util.dispatcherTypeCreator(
                        'async',
                        requestInfo.commonAsync,
                        router.asyncData || requestInfo.commonAsync
                    );
                }
                util.log(`${router.method} ${router.url}`);
                return yield next;
            }
        }

        /**
         * ② 未拦截到 router
         */
        if ( this.request.query.mode != 1) {
            return;
        }
        
        for (let [route, handler] of routeMap) {
            if ( requestPath.endsWith(route)  ) {
                util.debugLog(_.inspect(requestInfo));
                handler.call(this, requestInfo);
                return yield next;
            }
        }
    }
}
