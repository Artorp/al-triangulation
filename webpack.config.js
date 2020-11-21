const path = require('path');

module.exports = {
    entry: './src/main.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            }
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'bundle'),
        library: "ALTriangulation",
        libraryTarget: "umd",
        umdNamedDefine: true,
        globalObject: "this"
    },
    target: "electron8.3-renderer",
    devtool: "inline-source-map"
};
