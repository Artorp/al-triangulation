import { intersect_lines, multiply_scalar_2d, normalize, Point } from "./geometry";
import exp = require("constants");

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
