import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";

const Status = lazy(() => import("./pages/Status"));
const MagicNotes = lazy(() => import("./pages/MagicNotes"));
const TavernRumors = lazy(() => import("./pages/TavernRumors"));

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<div className="min-h-[40vh]" />}>
          <Routes>
            <Route path="/" element={<Status />} />
            <Route path="/magic-notes/*" element={<MagicNotes />} />
            <Route path="/tavern-rumors" element={<TavernRumors />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
