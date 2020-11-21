# al-triangulation

A few functions for generating navmesh for Adventure Land (code MMORPG).

## Requirements

Meant to be used with NodeJS, either standalone or as a package from within Adventure Land.

Requires NPM to be installed locally.

## Installation

Clone or download repository to folder of your choice. Navigate to folder and install required packages:

    npm install

## Bundle (optional)

Webpack is configured to bundle the source code into a single js file, which can be uploaded into an Adventure Land code slot. Run the following command to build a bundle:

    npm run build

A js file `bundle/bundle.js` will be created. This file can be required directly, or uploaded to a code slot and required through AL's `require_code` function.

## Usage

The package can be imported using CommonJS directly by specifying the absolute or relative path to the `al-triangulation` folder.

```js
const ALTriangulation = require("./al-triangulation");
const { vertices, edge_indices, faces } = ALTriangulation.generate_navmesh(map_data, from_position);
console.log(`The navmesh has ${faces.length} quads.`);
```
