const path = require('path');

module.exports = {
    entry: './src/wp_entry_point.js',
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
        library: "myLibrary",
        libraryTarget: "umd",
        umdNamedDefine: true
    },
    target: "node",
    devtool: "inline-source-map"
};
