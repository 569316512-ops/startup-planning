// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PostCard } from "../src/components/Catalog";
import type { PublicLead } from "../shared/business-contracts";
afterEach(cleanup);
it("shows_no_more_than_four_tags_and_explicit_lease_label", () => {
  const p = {
    id: "post",
    kind: "room",
    title: "采光好找室友",
    city: "贵阳",
    district: "云岩区",
    budget: 1000,
    minLeaseMonths: 3,
    moveIn: "下月",
    housing: { amenities: ["一", "二", "三", "四", "五"] },
    publisher: { nickname: "小李" },
  } as PublicLead;
  render(<PostCard post={p} open={() => {}} />);
  expect(screen.queryByText("五")).toBeNull();
  expect(screen.getByText("3个月起")).toBeTruthy();
});
