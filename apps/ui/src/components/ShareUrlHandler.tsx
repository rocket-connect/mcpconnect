// apps/ui/src/components/ShareUrlHandler.tsx
import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/**
 * Component to handle share URL routing issues
 * This ensures share URLs work even if the server doesn't properly serve the SPA
 */
export const ShareUrlHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if we're on the root and have share data in the URL
    if (location.pathname === "/" && window.location.href.includes("/share/")) {
      const fullUrl = window.location.href;
      const shareMatch = fullUrl.match(/\/share\/([^?#]+)(\?[^#]*)?/);

      if (shareMatch) {
        const shareData = shareMatch[1];
        const queryString = shareMatch[2] || "";

        // Navigate to the proper share route
        navigate(`/share/${shareData}${queryString}`, { replace: true });
      }
    }
  }, [location, navigate]);

  return null; // This component renders nothing
};
