/**
 * 预处理器 api，用于
 */
import {resolve, relative} from 'path';
import vinylFs from 'vinyl-fs';
import EventEmitter from 'events';

class PreCompiler extends EventEmitter {
    constructor(options) {
        super();
        Object.assign(this, options);
    }

    pipe(...args) {
        this.source = this.source.pipe.apply(this.source, args);
        Object.assign(args[0], EventEmitter.prototype);

        args[0].on('returnDependencys', (event) => {
            return this.emit('updateWatch', event);
        });
        return this;
    }

    dest( arg1 ) {
        const parent = resolve( this.file.filename, '..');
        const relativePath = relative( this.file.pattern, parent);
        const resultPath = resolve( arg1, relativePath);

        return vinylFs.dest.call(vinylFs, resultPath);
    }

    update() {
        this.source = vinylFs.src(this.file.filename);
        this.handler( this.dest.bind(this) ).forEach( (item) => {
            this.pipe(item);
        });
    }

    run() {
        this.update();
    }
}
export default PreCompiler;
