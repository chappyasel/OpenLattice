import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { CommandMenu, CommandMenuProvider } from "@/components/command-menu";
import { ThemeToggleShortcut } from "@/components/theme-toggle-shortcut";
import { api } from "@/trpc/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    void api.topics.listTree.prefetch();
    void api.topics.list.prefetch({ status: "published" });
    void api.tags.list.prefetch();

    return (
        <CommandMenuProvider>
            <SidebarProvider defaultOpen={true}>
                <AppSidebar />
                <SidebarInset>
                    <main className="min-w-0 flex-1 overflow-auto">
                        {children}
                    </main>
                </SidebarInset>
                <MobileBottomNav />
            </SidebarProvider>
            <CommandMenu />
            <ThemeToggleShortcut />
        </CommandMenuProvider>
    );
}
