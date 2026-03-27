import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [mobile, setMobile] = React.useState(() => window.innerWidth < 768); // 768px = mobile threshold
  React.useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}


// ── CREDENTIALS ───────────────────────────────────────────────────────────────

export { useIsMobile };
export default useIsMobile;