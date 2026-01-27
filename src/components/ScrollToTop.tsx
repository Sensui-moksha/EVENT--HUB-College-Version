import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop
 * Scrolls window to top whenever the route pathname changes.
 * Place this inside the Router so it can observe navigation changes.
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Use requestAnimationFrame to ensure it runs after DOM updates
    const id = window.requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      } catch (err) {
        // fallback for older browsers
        window.scrollTo(0, 0);
      }
    });

    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
