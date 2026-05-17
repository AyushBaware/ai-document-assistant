import './App.css'
import BackgroundGlow from "./components/BackgroundGlow";
import HeroSection from "./components/HeroSection";
import UploadBox from "./components/UploadBox";

function App() {
  return (
    <div className="relative min-h-screen bg-[#030712] overflow-hidden text-white">

      <BackgroundGlow />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-24">

        <HeroSection />

        <UploadBox />

      </div>

    </div>
  );
}

export default App;
