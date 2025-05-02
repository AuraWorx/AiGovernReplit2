import { useEffect } from "react";
import { useLocation } from "wouter";

export default function HomePage() {
  const [_, navigate] = useLocation();
  
  // Redirect to dashboard
  useEffect(() => {
    navigate("/");
  }, [navigate]);
  
  return null;
}
