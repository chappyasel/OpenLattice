import Link from "next/link";

export default function NotFound() {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
            <p className="font-serif text-[8rem] font-bold leading-none tracking-tight text-stone-200">
                404
            </p>
            <h1 className="mt-2 font-serif text-2xl font-semibold text-stone-800">
                Page not found
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
            <Link
                href="/"
                className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
                Back to home
            </Link>
        </div>
    );
}
