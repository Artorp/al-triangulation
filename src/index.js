/**
 * Webpack entry point (as defined in webpack.config.entry)
 * */

const { generate_navmesh } = require("./generate_navmesh");

module.exports = {
    generate_navmesh
}
