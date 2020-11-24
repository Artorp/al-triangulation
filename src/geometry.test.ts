import { intersect_lines, multiply_scalar_2d, normalize, Point, point_is_left, winding_number } from "./geometry";
import exp = require("constants");

/*
 * Note: Assumes a coordinate system where +x is east and +y is north
 */

// Helper functions
const P = (x: number, y: number): Point => ({ x, y });
class PolyBuilder {
    poly: Point[]
    constructor(x: number, y: number) {
        this.poly = [P(x, y)];
    }
    get p() {
        return this.poly[this.poly.length - 1];
    }
    north(v: number) {
        this.poly.push(P(this.p.x, this.p.y + v));
        return this;
    }
    east(v: number) {
        this.poly.push(P(this.p.x + v, this.p.y));
        return this;
    }
    south(v: number) {
        this.poly.push(P(this.p.x, this.p.y - v));
        return this;
    }
    west(v: number) {
        this.poly.push(P(this.p.x - v, this.p.y));
        return this;
    }
    build() {
        return this.poly;
    }
}

describe("Geometry Intersect lines", () => {

    const pointIs = (p: Point, x: number, y: number) => p.x === x && p.y === y;

    test("Simple intersection", () => {
        // line from (0, 0) -> (0, 10) and (-5, 5),(5, 5) should meet at point (0, 5)
        const result = intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: -5, y: 5 }, { x: 10, y: 0 });
        expect(result).toBeDefined();
        expect(pointIs(result!, 0, 5)).toBeTruthy();
    })

    test("Exclusive intersection", () => {
        // line from (0, 0) -> (0, 10) and (0, 0), (0, 10) do not intersect
        const result = intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 0, y: 10 });
        expect(result).toBeNull();
    })

    test("Simple intersection", () => {
        // line from (0, 0) -> (0, 10) and (0, 0), (10, 0) intersects inclusive at (0, 0)
        const result = intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 });
        expect(result).toBeDefined();
        expect(pointIs(result!, 0, 0)).toBeTruthy();
    })

    test("Simple non-intersection", () => {
        // line from (5, 0) -> (15, 0) and (0, 5), (0, 15) do not intersect
        const result = intersect_lines({ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 0, y: 10 });
        expect(result).toBeNull();
    })



    test("Exclusive check", () => {
        // line from (0, 0) -> (1472, 64) and (1104, 40)->(1104, 48), and (1104, 48)->(1112, 48) do not intersect
        let ray = { x: 1472, y: 64 };
        ray = multiply_scalar_2d(normalize(ray), 10000);

        const result1 = intersect_lines({ x: 0, y: 0 }, { x: 1472, y: 64 }, { x: 1104, y: 40 }, { x: 0, y: 8 });
        const result2 = intersect_lines({ x: 0, y: 0 }, { x: 1472, y: 64 }, { x: 1104, y: 48 }, { x: 8, y: 0 });

        expect(result1).toBeDefined();
        expect(result2).toBeDefined();

        // Expect (1104, 48) on both
        expect(pointIs(result1!, 1104, 48)).toBeTruthy();
        expect(pointIs(result2!, 1104, 48)).toBeTruthy();

        const result = intersect_lines({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 0, y: 0 }, { x: 10, y: 0 });
        expect(result).toBeDefined();
        expect(pointIs(result!, 0, 0)).toBeTruthy();
    })
})


describe("Is left signed area", () => {

    test("Simple case left", () => {
        const result = point_is_left(P(0, 0), P(0, 5), P(-2, 0));

        expect(result).toBeGreaterThan(0);
    })

    test("Simple case right", () => {
        const result = point_is_left(P(0, 0), P(0, 5), P(2, 0));

        expect(result).toBeLessThan(0);
    })

    test("Simple case straight", () => {
        const result = point_is_left(P(0, 0), P(0, 5), P(0, 10));

        expect(result).toEqual(0);
    })

    test("Simple case turn", () => {
        const result = point_is_left(P(0, 0), P(0, 5), P(0, 0));

        expect(result).toEqual(0);
    })
})

describe("Winding number", () => {
    test("Simple (CCW) triangle", () => {
        const wn = winding_number(P(5, 2), [P(0, 0), P(10, 0), P(5, 10)]);

        expect(wn).not.toBe(0);
    })

    test("CW triangle", () => {
        // this triangle is defined in clock-wise order, so a point "inside" it should have a non-zero and negative wn
        const wn = winding_number(P(5, 2), [P(0, 0), P(5, 10), P(10, 0)]);

        expect(wn).toBe(-1);
    })

    test("Rectangle inside", () => {
        const poly = new PolyBuilder(0, 0).east(5).north(5).west(5).build();
        const p = P(2, 2);

        const wn = winding_number(p, poly);

        expect(wn).not.toBe(0);
    })

    test("Rectangle point outside to the right of rectangle", () => {
        const poly = new PolyBuilder(0, 0).east(5).north(5).west(5).build();
        const p = P(10, 2);

        const wn = winding_number(p, poly);

        expect(wn).toBe(0);
    })

    test("Rectangle outside", () => {
        const poly = new PolyBuilder(0, 0).east(5).north(5).west(5).build();
        const p = P(20, 2);

        const wn = winding_number(p, poly);

        expect(wn).toBe(0);
    })

    test("Rectangle CW inside", () => {
        const poly = new PolyBuilder(0, 0).north(5).east(5).south(5).build();
        const p = P(2, 2);

        const wn = winding_number(p, poly);

        // polygon winds around the point once, in negative fashion
        expect(wn).toBe(-1);
    })

    test("Check points on rect vertices, only bot left is inside poly", () => {
        const poly = new PolyBuilder(0, 0).east(5).north(5).west(5).build();
        const bot_left = P(0, 0);
        const bot_right = P(5, 0);
        const top_right = P(5, 5);
        const top_left = P(0, 5);

        const wn_bot_left = winding_number(bot_left, poly);
        const wn_bot_right = winding_number(bot_right, poly);
        const wn_top_right = winding_number(top_right, poly);
        const wn_top_left = winding_number(top_left, poly);

        expect(wn_bot_left).not.toBe(0);
        expect(wn_bot_right).toBe(0);
        expect(wn_top_right).toBe(0);
        expect(wn_top_left).toBe(0);
    })

    test("Check points on rect edges, only bot and left is inside poly", () => {
        const poly = new PolyBuilder(0, 0).east(5).north(5).west(5).build();
        const bot = P(2, 0);
        const left = P(0, 2);
        const right = P(5, 2);
        const top = P(2, 5);

        const wn_bot = winding_number(bot, poly);
        const wn_left = winding_number(left, poly);
        const wn_right = winding_number(right, poly);
        const wn_top = winding_number(top, poly);

        expect(wn_bot).not.toBe(0);
        expect(wn_left).not.toBe(0);
        expect(wn_right).toBe(0);
        expect(wn_top).toBe(0);
    })

    test("winter_inn outside contour", () => {
        // this outside contour will wind around the spawn point
        const poly: Point[] = [
            { x: -184, y: 14 },   { x: 184, y: 14 },
            { x: 184, y: -33 },   { x: 136, y: -33 },
            { x: 136, y: -58 },   { x: 184, y: -58 },
            { x: 184, y: -113 },  { x: 136, y: -113 },
            { x: 136, y: -138 },  { x: 184, y: -138 },
            { x: 184, y: -217 },  { x: 120, y: -217 },
            { x: 120, y: -201 },  { x: 56, y: -201 },
            { x: 56, y: -225 },   { x: -72, y: -225 },
            { x: -72, y: -185 },  { x: -184, y: -185 },
            { x: -184, y: -122 }, { x: -132, y: -122 },
            { x: -132, y: -97 },  { x: -184, y: -97 },
            { x: -184, y: -58 },  { x: -132, y: -58 },
            { x: -132, y: -33 },  { x: -184, y: -33 }
        ];
        // since adventure land uses +y = south and winding_number expects +y = north, reverse y
        for (let i = 0; i < poly.length; i++) {
            poly[i].y = -poly[i].y;
        }
        const p = P(0, -5);

        const wn = winding_number(p, poly);
        expect(wn).not.toBe(0);
    })

    test("winter_inn inside contour", () => {
        // this outside contour will wind around the spawn point
        const poly: Point[] = [
            { x: -192, y: 192 },
            { x: -80, y: 192 },
            { x: -80, y: 232 },
            { x: 64, y: 232 },
            { x: 64, y: 208 },
            { x: 112, y: 208 },
            { x: 112, y: 224 },
            { x: 192, y: 224 },
            { x: 192, y: -16 },
            { x: -192, y: -16 }
        ];
        const p = P(-160, 40);

        const wn = winding_number(p, poly);
        expect(wn).not.toBe(0);
    })

    test("winter_inn hole contour", () => {
        // this hole contour will not wind around the spawn point
        const poly: Point[] = [
            { x: -60, y: -33 },
            { x: -116, y: -33 },
            { x: -116, y: -58 },
            { x: -60, y: -58 }
        ];
        // since adventure land uses +y = south and winding_number expects +y = north, reverse y
        for (let i = 0; i < poly.length; i++) {
            poly[i].y = -poly[i].y;
        }
        const p = P(0, -5);

        const wn = winding_number(p, poly);
        expect(wn).toBe(0);
    })
})
