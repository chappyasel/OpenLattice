"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { type DialogProps } from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";

import {
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md text-popover-foreground",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends DialogProps {
  shouldFilter?: boolean;
  onHighlightChange?: (value: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CommandDialog = ({
  children,
  shouldFilter = true,
  onHighlightChange,
  open,
  onOpenChange,
  ...props
}: CommandDialogProps) => {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    setIsMobile(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const initial = isMobile
    ? { opacity: 0, scale: 0.9, y: 50, x: "-50%" }
    : { opacity: 0, scale: 0.9, y: -20, x: "-60%" };

  const animate = { opacity: 1, scale: 1, y: 0, x: "-50%" };

  const exit = isMobile
    ? { opacity: 0, scale: 0.9, y: 50, x: "-50%" }
    : { opacity: 0, scale: 0.9, y: -20, x: "-60%" };

  const transformOrigin = isMobile ? "bottom center" : "top left";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} {...props}>
      <AnimatePresence>
        {open && (
          <DialogPortal forceMount>
            <DialogOverlay asChild>
              <motion.div
                className="!z-[100]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </DialogOverlay>
            <DialogPrimitive.Content asChild>
              <motion.div
                initial={initial}
                animate={animate}
                exit={exit}
                transition={{
                  type: "spring",
                  duration: 0.25,
                  bounce: 0.15,
                }}
                style={{
                  transformOrigin,
                  backgroundColor: "hsl(var(--popover) / 0.8)",
                }}
                className="fixed left-1/2 top-4 z-[100] w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-xl border p-0 shadow-lg backdrop-blur-xl sm:top-[20vh]"
              >
                <DialogTitle className="sr-only">Command Menu</DialogTitle>
                <Command
                  shouldFilter={shouldFilter}
                  onValueChange={onHighlightChange}
                  loop
                  defaultValue=""
                  className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:p-2"
                >
                  {children}
                </Command>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPortal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
};

const CommandDialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Close
    ref={ref}
    className={cn(
      "rounded-full p-2 -mr-1 opacity-70 hover:bg-accent text-muted-foreground transition-opacity hover:opacity-100 focus:outline-none",
      className,
    )}
    {...props}
  >
    <XIcon className="size-4" weight="bold" />
    <span className="sr-only">Close</span>
  </DialogPrimitive.Close>
));
CommandDialogClose.displayName = "CommandDialogClose";

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
    hideSearchIcon?: boolean;
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
  }
>(({ className, hideSearchIcon, icon, rightElement, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    {icon ?? (
      <MagnifyingGlassIcon
        className={cn(
          "mr-2 size-4 shrink-0 opacity-50",
          hideSearchIcon && "invisible",
        )}
      />
    )}
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-[10px] bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
    {rightElement}
  </div>
));

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      "max-h-[min(750px,calc(80vh-66px))] overflow-y-auto overflow-x-hidden",
      className,
    )}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ children, className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn(
      "flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground",
      className,
    )}
    {...props}
  >
    <MagnifyingGlassIcon className="size-8 opacity-40" weight="duotone" />
    <span>{children}</span>
  </CommandPrimitive.Empty>
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-[hsl(var(--accent)/0.7)] data-[selected='true']:backdrop-blur-sm data-[selected='true']:ring-1 data-[selected='true']:ring-[hsl(var(--primary)/0.2)] data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "ml-auto text-xs tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandDialogClose,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
