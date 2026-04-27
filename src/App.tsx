import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import Status from "./pages/Status";
import MagicNotes from "./pages/MagicNotes";
import TavernRumors from "./pages/TavernRumors";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Status />} />
          <Route path="/magic-notes/*" element={<MagicNotes />} />
          <Route path="/tavern-rumors" element={<TavernRumors />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
