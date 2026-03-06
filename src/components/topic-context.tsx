"use client";

import * as React from "react";

interface TopicContextType {
  selectedSlug: string | null;
  setSelectedSlug: (slug: string | null) => void;
}

const TopicContext = React.createContext<TopicContextType>({
  selectedSlug: null,
  setSelectedSlug: () => {},
});

export function TopicProvider({ children }: { children: React.ReactNode }) {
  const [selectedSlug, setSelectedSlug] = React.useState<string | null>(null);

  const value = React.useMemo(
    () => ({ selectedSlug, setSelectedSlug }),
    [selectedSlug],
  );

  return (
    <TopicContext.Provider value={value}>{children}</TopicContext.Provider>
  );
}

export function useTopicContext() {
  return React.useContext(TopicContext);
}
