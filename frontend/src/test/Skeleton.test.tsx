import { render } from "@testing-library/react";
import { SkeletonLine, SkeletonCard, SkeletonTable, SkeletonPanel } from "../components/ui/Skeleton";

describe("SkeletonLine", () => {
  it("renders with default props", () => {
    const { container } = render(<SkeletonLine />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.tagName).toBe("SPAN");
  });

  it("renders with custom width and height", () => {
    const { container } = render(<SkeletonLine width="50%" height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el).toBeInTheDocument();
  });
});

describe("SkeletonCard", () => {
  it("renders default 3 lines", () => {
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBe(4);
  });

  it("renders specified number of lines", () => {
    const { container } = render(<SkeletonCard lines={5} />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBe(6);
  });
});

describe("SkeletonTable", () => {
  it("renders correct number of rows and cols", () => {
    const { container } = render(<SkeletonTable rows={3} cols={4} />);
    const skeletons = container.querySelectorAll(".MuiSkeleton-root");
    expect(skeletons.length).toBe(12);
  });
});

describe("SkeletonPanel", () => {
  it("renders without crashing", () => {
    const { container } = render(<SkeletonPanel />);
    expect(container.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
  });
});
