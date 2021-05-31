const gulp = require('gulp');
const webpack = require('webpack-stream');
function defaultTask(cb){
    return gulp.src('src/index.js')
        .pipe(webpack({
            output: {
                filename: 'oncogrid.min.js',
            },
            externals: {
                d3: "d3"
            },
            devtool: "source-map",
        }))
        .pipe(gulp.dest('dist/'));
    cb()
}
function hot(cb) {
    gulp.watch('src/**', defaultTask)
    cb()
}

exports.default = defaultTask
exports.hot = hot
