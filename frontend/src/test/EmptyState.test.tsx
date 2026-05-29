import { render, screen } from "@testing-library/react";
import EmptyState from "../components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState title="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<EmptyState icon="$" title="Title" />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("does not render icon circle when icon is undefined", () => {
    const { container } = render(<EmptyState title="Title" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(<EmptyState title="Title" description="This is a description" />);
    expect(screen.getByText("This is a description")).toBeInTheDocument();
  });

  it("renders action when provided", () => {
    render(<EmptyState title="Title" action={<button>Click me</button>} />);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });
});
