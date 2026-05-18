import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "./context/WalletContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import IssueCertificate from "./pages/IssueCertificate";
import VerifyCertificate from "./pages/VerifyCertificate";
import Manage from "./pages/Manage";
import Certificates from "./pages/Certificates";
import CertificateDetail from "./pages/CertificateDetail.jsx";

import "./index.css";

const App = () => (
  <WalletProvider>
    <BrowserRouter>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/issue" element={<IssueCertificate />} />
          <Route path="/verify" element={<VerifyCertificate />} />
          <Route path="/manage" element={<Manage />} />
          <Route path="/certificates" element={<Certificates />} />
          <Route path="/certificates/:hash" element={<CertificateDetail />} />
        </Routes>
      </main>

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "#1a1d26",
            color: "#e2e8f0",
            border: "1px solid #2a2d3e",
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "14px",
            borderRadius: "12px",
          },
          success: { iconTheme: { primary: "#22c55e", secondary: "#1a1d26" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#1a1d26" } },
        }}
      />
    </BrowserRouter>
  </WalletProvider>
);

export default App;
