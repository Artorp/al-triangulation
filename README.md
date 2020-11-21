# al-triangulation

A few functions for generating navmesh for Adventure Land (code MMORPG).

## Requirements

Meant to be used with NodeJS, either standalone or as a package from within Adventure Land.

Requires NPM to be installed locally.

## Installation

Clone or download repository to folder of your choice. Navigate to folder and install required packages:

    npm install

## Usage

The package can be imported using CommonJS directly by specifying the absolute or relative path to the `al-triangulation` folder.

```js
const ALTriangulation = require("./al-triangulation");
const { vertices, edge_indices, faces } = ALTriangulation.generate_navmesh(map_data, from_position);
console.log(`The navmesh has ${faces.length} quads.`);
```
