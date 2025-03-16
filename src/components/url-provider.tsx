"use client";

import React, { useEffect, useState } from "react";

interface UrlProviderProps {
  children: React.ReactNode;
}

export function UrlProvider({ children }: UrlProviderProps) {
  const [currentUrl, setCurrentUrl] = useState<string>("");

  useEffect(() => {
    // Get the full URL information
    const baseUrl = window.location.origin;
    
    // Check if we're behind a proxy like ngrok by looking at the hostname
    const isProxy = !baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1');
    
    // Store the URL for use in the form
    setCurrentUrl(baseUrl);
    
    // If we're using a proxy like ngrok, log for debugging
    if (isProxy) {
      console.log('Using proxy URL for redirects:', baseUrl);
    }
  }, []);

  // Clone children and add the currentUrl as a hidden input
  const childrenWithUrl = React.Children.map(children, (child) => {
    if (React.isValidElement(child) && child.type === 'form') {
      return React.cloneElement(child, {}, [
        ...React.Children.toArray(child.props.children),
        <input key="site-url-input" type="hidden" name="site_url" value={currentUrl} />
      ]);
    }
    return child;
  });

  return <>{childrenWithUrl}</>;
} 