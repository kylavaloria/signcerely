import { describe, expect, it } from "vitest";
import { pageList } from "./Pagination";

describe("pageList", () => {
  it("shows every page when there are few", () => {
    expect(pageList(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });
  it("collapses the middle with gaps", () => {
    expect(pageList(1, 10)).toEqual([1, 2, 3, 4, null, 10]);
    expect(pageList(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
    expect(pageList(10, 10)).toEqual([1, null, 7, 8, 9, 10]);
  });
});
