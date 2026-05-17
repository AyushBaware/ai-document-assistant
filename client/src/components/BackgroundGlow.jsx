function BackgroundGlow() {
  return (
    <>
      <div className="absolute top-[-120px] left-[-100px] w-[300px] h-[300px] bg-cyan-500 opacity-20 blur-[120px] rounded-full"></div>

      <div className="absolute bottom-[-120px] right-[-100px] w-[300px] h-[300px] bg-purple-500 opacity-20 blur-[120px] rounded-full"></div>
    </>
  );
}

export default BackgroundGlow;