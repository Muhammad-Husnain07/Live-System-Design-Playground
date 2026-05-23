import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorBoundary from "../components/ui/ErrorBoundary";

const ThrowError = ({ message }: { message: string }) => {
  throw new Error(message);
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  (console.error as any).mockRestore();
});

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>All good</div>
      </ErrorBoundary>
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test crash" />
      </ErrorBoundary>
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Test crash")).toBeInTheDocument();
  });

  it("resets on Try Again click", async () => {
    const user = userEvent.setup();
    let shouldThrow = true;

    function FlakyComponent() {
      if (shouldThrow) {
        throw new Error("Flaky");
      }
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <ErrorBoundary key="boundary">
        <FlakyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    shouldThrow = false;

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    rerender(
      <ErrorBoundary>
        <FlakyComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText("Recovered")).toBeInTheDocument();
  });
});
