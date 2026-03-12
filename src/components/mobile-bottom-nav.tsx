"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  MagnifyingGlassIcon,
  LightbulbIcon,
  XIcon,
  ListIcon,
} from "@phosphor-icons/react";
import { useSidebar } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function MobileBottomNav() {
  const isMobile = useIsMobile();
  const { open, openMobile, toggleSidebar } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show on mobile always, or on desktop when sidebar is closed
  const showPill = isMobile || !open;
  const sidebarOpen = isMobile ? openMobile : open;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {showPill && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center pb-[env(safe-area-inset-bottom)]">
          <motion.div
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-foreground px-2 py-1.5 text-background shadow-lg"
            initial={{ y: 100, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              x: sidebarOpen && isMobile ? "calc(50vw - 50% - 16px)" : 0,
            }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <button
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-background/10"
              onClick={() => {
                document.dispatchEvent(
                  new KeyboardEvent("keydown", {
                    key: "k",
                    metaKey: true,
                    bubbles: true,
                  }),
                );
              }}
            >
              <MagnifyingGlassIcon className="size-4" weight="bold" />
              <span className="text-sm">Find...</span>
            </button>

            <div className="h-5 w-px bg-background/20" />

            <Link
              href="/claims"
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors hover:bg-background/10"
            >
              <LightbulbIcon className="size-4" weight="bold" />
              <span className="text-sm">Claims</span>
            </Link>

            <div className="h-5 w-px bg-background/20" />

            <button
              className="flex size-8 items-center justify-center rounded-full transition-colors hover:bg-background/10"
              onClick={toggleSidebar}
            >
              <AnimatePresence mode="wait" initial={false}>
                {sidebarOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <XIcon className="size-5" weight="bold" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ListIcon className="size-5" weight="bold" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
