const path = require('path');

module.exports = {
    entry: './src/index.js',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.json$/,
                exclude: /map_data/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        library: "ALTriangulation",
        libraryTarget: "umd",
        umdNamedDefine: true,
        globalObject: "this"
    },
    target: "electron8.3-renderer",
    devtool: "inline-source-map"
};
