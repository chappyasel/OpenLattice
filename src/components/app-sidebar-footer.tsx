"use client";

import {
  CaretUpDownIcon,
  DesktopIcon,
  MoonIcon,
  SignOutIcon,
  SunIcon,
  UserIcon,
} from "@phosphor-icons/react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebarFooter() {
  const session = useSession();
  const { setTheme, theme, systemTheme } = useTheme();
  const currentTheme = theme === "system" ? systemTheme : theme;
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [signoutDialogOpen, setSignoutDialogOpen] = useState(false);

  const handleToggleTheme = () => {
    const currentThemeValue = theme === "system" ? "light" : theme;
    const newTheme = currentThemeValue === "light" ? "dark" : "light";
    setTheme(newTheme);
  };

  const handleSignOut = async () => {
    await signOut();
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const user = session.data?.user;

  if (session.status === "loading") {
    return <SidebarFooter />;
  }

  if (!user) {
    return (
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Sign in"
              onClick={() => void signIn("google")}
            >
              <div className="flex size-6 items-center justify-center rounded-full bg-sidebar-accent">
                <UserIcon className="size-4" weight="bold" />
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium">Sign in</span>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    );
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  tooltip={user.name ?? "User"}
                >
                  {user.image ? (
                    <img
                      src={user.image}
                      alt={user.name ?? ""}
                      className="size-6 rounded-full shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex size-6 items-center justify-center rounded-full bg-sidebar-accent text-xs font-medium">
                      {initials ?? <UserIcon className="size-4" weight="bold" />}
                    </div>
                  )}
                  {!isCollapsed && (
                    <>
                      <div className="-ml-1 -mr-2 grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">
                          {user.name ?? "User"}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </div>
                      <CaretUpDownIcon className="-mr-1.5 size-4 shrink-0 opacity-50" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-48"
                side="top"
                align="start"
                sideOffset={4}
              >
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    {currentTheme === "dark" ? (
                      <MoonIcon className="mr-2 size-4" weight="bold" />
                    ) : (
                      <SunIcon className="mr-2 size-4" weight="bold" />
                    )}
                    Theme
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={handleToggleTheme}>
                        <MoonIcon className="mr-2 size-4" weight="bold" />
                        Toggle
                        <DropdownMenuShortcut>⌥⌘L</DropdownMenuShortcut>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setTheme("light")}>
                        <SunIcon className="mr-2 size-4" weight="bold" />
                        Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("dark")}>
                        <MoonIcon className="mr-2 size-4" weight="bold" />
                        Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme("system")}>
                        <DesktopIcon className="mr-2 size-4" weight="bold" />
                        System
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setSignoutDialogOpen(true)}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                >
                  <SignOutIcon className="mr-2 size-4" weight="bold" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <Dialog open={signoutDialogOpen} onOpenChange={setSignoutDialogOpen}>
        <DialogContent>
          <DialogHeader className="flex-row items-end gap-2">
            <SignOutIcon className="size-5" weight="bold" />
            <DialogTitle>Sign out</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Are you sure you want to sign out from CAIK?
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setSignoutDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSignOut()}>Confirm</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
