import { render } from "@testing-library/react";
import { SkeletonLine, SkeletonCard, SkeletonTable, SkeletonPanel } from "../components/ui/Skeleton";

describe("SkeletonLine", () => {
  it("renders with default props", () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass("animate-pulse");
    expect(el.style.width).toBe("100%");
    expect(el.style.height).toBe("12px");
  });

  it("renders with custom width and height", () => {
    const { container } = render(<SkeletonLine width="50%" height={20} className="extra" />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("50%");
    expect(el.style.height).toBe("20px");
    expect(el).toHaveClass("extra");
  });
});

describe("SkeletonCard", () => {
  it("renders default 3 lines", () => {
    const { container } = render(<SkeletonCard />);
    const lines = container.querySelectorAll(".animate-pulse");
    expect(lines.length).toBe(4);
  });

  it("renders specified number of lines", () => {
    const { container } = render(<SkeletonCard lines={5} />);
    const lines = container.querySelectorAll(".animate-pulse");
    expect(lines.length).toBe(6);
  });
});

describe("SkeletonTable", () => {
  it("renders correct number of rows and cols", () => {
    const { container } = render(<SkeletonTable rows={3} cols={4} />);
    const lines = container.querySelectorAll(".animate-pulse");
    expect(lines.length).toBe(12);
  });
});

describe("SkeletonPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonPanel />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
});
