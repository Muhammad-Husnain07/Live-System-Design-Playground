import { BrowserRouter, Routes, Route } from "react-router-dom";

function App() {
  return (
    <BrowserRouter>
      <div className="h-screen w-screen bg-surface-950 text-surface-100 flex flex-col">
        <Routes>
          <Route path="/" element={<div className="flex-1 flex items-center justify-center text-surface-400">Live System Design Playground</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
